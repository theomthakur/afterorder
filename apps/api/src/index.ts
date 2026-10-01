import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rawBody from 'fastify-raw-body';
import crypto from 'node:crypto';
import { claimOperation, consumeMerchantAuthorizationChallenge, createMerchantAuthorizationChallenge, createOrder, getLatestOrder, getOrder, getOrderByShopifyId, getRuntimeSetting, resumeWorkflow, saveMerchantAuthorization, setRuntimeSetting } from './db.ts';
import { runWorkflow, startWorkers, subscribe } from './workflow.ts';
import { startDemoSchema } from '../../../packages/shared/src/schemas.ts';
import { chainIsLive, getActiveMandateStatus } from './integrations/chain.ts';
import { createPublicClient, encodePacked, http, keccak256, parseUnits, toBytes, verifyMessage, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { z } from 'zod';
import { verifyShopifyWebhook } from './integrations/shopifyWebhook.ts';
import { resetDemoSuppliers } from './integrations/suppliers.ts';
import { buildOrderProofReport } from './proofReport.ts';

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true });
await app.register(rawBody, { field: 'rawBody', global: false, encoding: 'utf8', runFirst: true });

app.get('/api/health', async () => ({ ok: true, mode: process.env.APP_MODE ?? 'sandbox', dependencies: {
  openrouter: Boolean(process.env.OPENROUTER_API_KEY), monad: chainIsLive(),
  shopify: Boolean(process.env.SHOPIFY_ACCESS_TOKEN), envio: Boolean(process.env.ENVIO_GRAPHQL_URL)
} }));
app.get('/api/orders/latest', async () => getLatestOrder());
app.get('/api/merchant/mandate/status', async () => ({ mode: chainIsLive() ? 'onchain' : 'sandbox', mandate: await getActiveMandateStatus() }));
app.get<{ Params: { id: string } }>('/api/orders/:id', async (request, reply) => getOrder(request.params.id) ?? reply.code(404).send({ error: 'Order not found' }));
app.get<{ Params: { id: string } }>('/api/orders/:id/proof.md', async (request, reply) => {
  const order = getOrder(request.params.id);
  if (!order) return reply.code(404).send({ error: 'Order not found' });
  const filename = `afterorder-${order.displayOrder.replace(/[^a-zA-Z0-9_-]+/g, '').toLowerCase() || order.id}-proof.md`;
  return reply
    .header('Content-Type', 'text/markdown; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .send(buildOrderProofReport(order, { explorerUrl: process.env.MONAD_EXPLORER_URL }));
});
app.post<{ Params: { id: string } }>('/api/orders/:id/resume', async (request, reply) => {
  if (!getOrder(request.params.id)) return reply.code(404).send({ error: 'Order not found' });
  if (!resumeWorkflow(request.params.id)) return reply.code(409).send({ error: 'Workflow is already running or complete' });
  void runWorkflow(request.params.id);
  return reply.code(202).send({ ok: true, id: request.params.id });
});
app.post('/api/demo/start', async (request, reply) => {
  const parsed = startDemoSchema.safeParse(request.body ?? {});
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  await resetDemoSuppliers();
  const id = crypto.randomUUID();
  createOrder({ id, shopifyOrderId: `sandbox-${id}`, displayOrder: `#AO-${id.slice(0, 4).toUpperCase()}`, sku: 'AO-DESK-01', product: 'Walnut desk organizer', quantity: 1, retailTotal: 60, mode: 'sandbox' });
  void runWorkflow(id, parsed.data.scenario);
  return reply.code(202).send({ id });
});

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
app.post('/api/merchant/authorization/challenge', async (request, reply) => {
  const parsed = z.object({ address: addressSchema }).safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  const nonce = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const message = [
    'AfterOrder merchant authorization',
    `Wallet: ${parsed.data.address}`,
    'Maximum: 40 DemoUSD per order',
    'Purpose: supplier fulfillment on Monad testnet',
    `Chain ID: ${process.env.MONAD_CHAIN_ID ?? 10143}`,
    `Mandate registry: ${process.env.MANDATE_REGISTRY_ADDRESS ?? 'sandbox-not-deployed'}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`
  ].join('\n');
  createMerchantAuthorizationChallenge(parsed.data.address, message, nonce, expiresAt);
  return { message, nonce, expiresAt };
});

const authorizationSchema = z.object({ address: addressSchema, message: z.string().min(20).max(1000), signature: z.string().regex(/^0x[0-9a-fA-F]+$/), nonce: z.string().uuid() });
app.post('/api/merchant/authorization', async (request, reply) => {
  const parsed = authorizationSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  const valid = await verifyMessage({ address: parsed.data.address as `0x${string}`, message: parsed.data.message, signature: parsed.data.signature as `0x${string}` });
  if (!valid) return reply.code(401).send({ error: 'Wallet signature is invalid' });
  if (!consumeMerchantAuthorizationChallenge(parsed.data.nonce, parsed.data.address, parsed.data.message)) return reply.code(409).send({ error: 'Authorization challenge is expired, mismatched, or already used' });
  saveMerchantAuthorization(parsed.data.address, parsed.data.message, parsed.data.signature);
  return { ok: true, address: parsed.data.address, mode: process.env.MANDATE_REGISTRY_ADDRESS ? 'signature_verified' : 'sandbox_signature_verified' };
});

const transactionHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
app.get('/api/merchant/mandate/config', async (request, reply) => {
  const parsed = z.object({ address: addressSchema }).safeParse(request.query);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  const publicKeys = ['MONAD_RPC_URL', 'MANDATE_REGISTRY_ADDRESS', 'ORDER_ESCROW_ADDRESS', 'SETTLEMENT_TOKEN_ADDRESS', 'SUPPLIER_A_WALLET', 'SUPPLIER_B_WALLET', 'EVIDENCE_SIGNER_WALLET'] as const;
  if (publicKeys.some((key) => !process.env[key]) || !process.env.PURCHASER_PRIVATE_KEY) return reply.code(503).send({ error: 'Monad deployment is not configured yet' });
  const supplierA = process.env.SUPPLIER_A_WALLET as Hex;
  const supplierB = process.env.SUPPLIER_B_WALLET as Hex;
  const leafA = keccak256(encodePacked(['address'], [supplierA]));
  const leafB = keccak256(encodePacked(['address'], [supplierB]));
  const supplierRoot = leafA < leafB ? keccak256(encodePacked(['bytes32', 'bytes32'], [leafA, leafB])) : keccak256(encodePacked(['bytes32', 'bytes32'], [leafB, leafA]));
  const purchaser = privateKeyToAccount(process.env.PURCHASER_PRIVATE_KEY as Hex).address;
  const issuedAt = Math.floor(Date.now() / 1000);
  const config = {
    chainId: Number(process.env.MONAD_CHAIN_ID ?? 10143), registry: process.env.MANDATE_REGISTRY_ADDRESS,
    escrow: process.env.ORDER_ESCROW_ADDRESS, token: process.env.SETTLEMENT_TOKEN_ADDRESS,
    mandateId: keccak256(toBytes(`afterorder:${parsed.data.address.toLowerCase()}:${crypto.randomUUID()}`)),
    delegate: purchaser, evidenceSigner: process.env.EVIDENCE_SIGNER_WALLET, perOrder: parseUnits('40', 6).toString(),
    cumulative: parseUnits('500', 6).toString(), validAfter: issuedAt - 30, expiresAt: issuedAt + 30 * 24 * 3600,
    supplierRoot, policyCommitment: keccak256(toBytes('AfterOrder: two approved suppliers; max 40 dUSD per order'))
  };
  setRuntimeSetting(`pending_mandate:${parsed.data.address.toLowerCase()}`, JSON.stringify(config));
  return config;
});

app.post('/api/merchant/mandate/confirm', async (request, reply) => {
  const parsed = z.object({ address: addressSchema, mandateId: transactionHashSchema, txHash: transactionHashSchema }).safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  const pendingRaw = getRuntimeSetting(`pending_mandate:${parsed.data.address.toLowerCase()}`);
  if (!pendingRaw) return reply.code(409).send({ error: 'No pending mandate exists for this wallet' });
  const pending = JSON.parse(pendingRaw) as { mandateId: Hex; registry: Hex; chainId: number };
  if (pending.mandateId.toLowerCase() !== parsed.data.mandateId.toLowerCase()) return reply.code(409).send({ error: 'Mandate does not match the issued configuration' });
  const chain = { id: pending.chainId, name: 'Monad Testnet', nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [process.env.MONAD_RPC_URL!] } } } as const;
  const client = createPublicClient({ chain, transport: http() });
  const receipt = await client.waitForTransactionReceipt({ hash: parsed.data.txHash as Hex, timeout: 30_000 });
  if (receipt.status !== 'success' || receipt.to?.toLowerCase() !== pending.registry.toLowerCase()) return reply.code(409).send({ error: 'Mandate transaction was not confirmed by the configured registry' });
  const authority = await client.readContract({ address: pending.registry, abi: [{ type: 'function', name: 'authority', stateMutability: 'view', inputs: [{ name: 'id', type: 'bytes32' }], outputs: [{ name: 'owner', type: 'address' }, { name: 'delegate', type: 'address' }, { name: 'token', type: 'address' }, { name: 'evidenceSigner', type: 'address' }, { name: 'supplierRoot', type: 'bytes32' }] }] as const, functionName: 'authority', args: [pending.mandateId] });
  if (authority[0].toLowerCase() !== parsed.data.address.toLowerCase()) return reply.code(409).send({ error: 'Connected wallet is not the mandate owner' });
  setRuntimeSetting('active_mandate_id', pending.mandateId);
  setRuntimeSetting('active_mandate_tx', parsed.data.txHash);
  return { ok: true, mode: 'onchain', mandateId: pending.mandateId, txHash: parsed.data.txHash };
});

type ShopifyPaidOrder = { id: string | number; name?: string; financial_status?: string; total_price?: string; line_items?: Array<{ sku?: string; name?: string; quantity?: number }> };
app.post<{ Body: ShopifyPaidOrder }>('/webhooks/shopify/orders-paid', { config: { rawBody: true } }, async (request, reply) => {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const signature = request.headers['x-shopify-hmac-sha256'];
  const raw = (request as typeof request & { rawBody?: string }).rawBody;
  if (!secret || typeof signature !== 'string' || !raw) return reply.code(401).send({ error: 'Shopify webhook verification is not configured' });
  if (!verifyShopifyWebhook(raw, signature, secret)) return reply.code(401).send({ error: 'Invalid Shopify signature' });
  if (!chainIsLive()) return reply.code(503).send({ error: 'A live merchant mandate and Monad settlement configuration are required before accepting paid orders' });
  if (!process.env.SHOPIFY_SHOP_DOMAIN || !process.env.SHOPIFY_ACCESS_TOKEN) return reply.code(503).send({ error: 'Shopify fulfilment access is not configured' });
  const webhookId = String(request.headers['x-shopify-webhook-id'] ?? crypto.createHash('sha256').update(raw).digest('hex'));
  if (!claimOperation(`shopify:${webhookId}`, crypto.createHash('sha256').update(raw).digest('hex'))) return { ok: true, duplicate: true };
  const payload = request.body;
  const line = payload.line_items?.[0];
  if (payload.financial_status && payload.financial_status !== 'paid') return reply.code(202).send({ ok: false, reason: 'Order is not fully paid' });
  if (!line || line.sku !== 'AO-DESK-01' || payload.line_items?.length !== 1) return reply.code(202).send({ ok: false, reason: 'Unsupported product mapping' });
  const shopifyOrderId = String(payload.id);
  const existing = getOrderByShopifyId(shopifyOrderId);
  if (existing) return { ok: true, duplicate: true, id: existing.id };
  const id = crypto.randomUUID();
  createOrder({ id, shopifyOrderId, displayOrder: payload.name ?? `#${shopifyOrderId}`, sku: line.sku, product: line.name ?? 'Walnut desk organizer', quantity: line.quantity ?? 1, retailTotal: Number(payload.total_price ?? 60), mode: 'live_test' });
  void runWorkflow(id, 'supplier_failover');
  return reply.code(202).send({ ok: true, id });
});
app.get('/api/events', async (request, reply) => {
  reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': process.env.WEB_ORIGIN ?? 'http://localhost:5173' });
  const send = (orderId: string) => reply.raw.write(`event: order\ndata: ${JSON.stringify({ orderId })}\n\n`);
  const unsubscribe = subscribe(send);
  const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 15000);
  request.raw.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
});

const port = Number(process.env.API_PORT ?? 4100);
await app.listen({ port, host: '127.0.0.1' });
startWorkers();
