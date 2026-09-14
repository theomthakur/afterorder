import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rawBody from 'fastify-raw-body';
import crypto from 'node:crypto';
import { claimOperation, createOrder, getLatestOrder, getOrder, getOrderByShopifyId, saveMerchantAuthorization } from './db.ts';
import { runWorkflow, subscribe } from './workflow.ts';
import { startDemoSchema } from '../../../packages/shared/src/schemas.ts';
import { chainIsLive } from './integrations/chain.ts';
import { verifyMessage } from 'viem';
import { z } from 'zod';
import { verifyShopifyWebhook } from './integrations/shopifyWebhook.ts';
import { resetDemoSuppliers } from './integrations/suppliers.ts';

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true });
await app.register(rawBody, { field: 'rawBody', global: false, encoding: 'utf8', runFirst: true });

app.get('/api/health', async () => ({ ok: true, mode: process.env.APP_MODE ?? 'sandbox', dependencies: {
  openrouter: Boolean(process.env.OPENROUTER_API_KEY), monad: chainIsLive(),
  shopify: Boolean(process.env.SHOPIFY_ACCESS_TOKEN), envio: Boolean(process.env.ENVIO_GRAPHQL_URL)
} }));
app.get('/api/orders/latest', async () => getLatestOrder());
app.get<{ Params: { id: string } }>('/api/orders/:id', async (request, reply) => getOrder(request.params.id) ?? reply.code(404).send({ error: 'Order not found' }));
app.post('/api/demo/start', async (request, reply) => {
  const parsed = startDemoSchema.safeParse(request.body ?? {});
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  await resetDemoSuppliers();
  const id = crypto.randomUUID();
  createOrder({ id, shopifyOrderId: `sandbox-${id}`, displayOrder: `#AO-${id.slice(0, 4).toUpperCase()}`, sku: 'AO-DESK-01', product: 'Walnut desk organizer', quantity: 1, retailTotal: 60, mode: 'sandbox' });
  void runWorkflow(id, parsed.data.scenario);
  return reply.code(202).send({ id });
});

const authorizationSchema = z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/), message: z.string().min(20).max(500), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) });
app.post('/api/merchant/authorization', async (request, reply) => {
  const parsed = authorizationSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  if (!parsed.data.message.includes(`Wallet: ${parsed.data.address}`) || !parsed.data.message.includes('Maximum: 40 DemoUSD per order')) return reply.code(400).send({ error: 'Authorization terms do not match the configured mandate' });
  const valid = await verifyMessage({ address: parsed.data.address as `0x${string}`, message: parsed.data.message, signature: parsed.data.signature as `0x${string}` });
  if (!valid) return reply.code(401).send({ error: 'Wallet signature is invalid' });
  saveMerchantAuthorization(parsed.data.address, parsed.data.message, parsed.data.signature);
  return { ok: true, address: parsed.data.address };
});

type ShopifyPaidOrder = { id: string | number; name?: string; financial_status?: string; total_price?: string; line_items?: Array<{ sku?: string; name?: string; quantity?: number }> };
app.post<{ Body: ShopifyPaidOrder }>('/webhooks/shopify/orders-paid', { config: { rawBody: true } }, async (request, reply) => {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const signature = request.headers['x-shopify-hmac-sha256'];
  const raw = (request as typeof request & { rawBody?: string }).rawBody;
  if (!secret || typeof signature !== 'string' || !raw) return reply.code(401).send({ error: 'Shopify webhook verification is not configured' });
  if (!verifyShopifyWebhook(raw, signature, secret)) return reply.code(401).send({ error: 'Invalid Shopify signature' });
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
