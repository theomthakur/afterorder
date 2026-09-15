import 'dotenv/config';
import Fastify from 'fastify';
import { z } from 'zod';
import { encodePacked, keccak256, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const port = Number(process.env.EVIDENCE_PORT ?? 4300);
const serviceToken = process.env.EVIDENCE_SERVICE_TOKEN ?? 'afterorder-evidence-local-only';
const supplierToken = process.env.SUPPLIER_SERVICE_TOKEN ?? 'afterorder-local-demo-only';
const supplierUrls: Record<string, string> = {
  supplier_a: process.env.SUPPLIER_A_URL ?? 'http://127.0.0.1:4201',
  supplier_b: process.env.SUPPLIER_B_URL ?? 'http://127.0.0.1:4202'
};

const requestSchema = z.object({
  chainId: z.number().int().positive(),
  escrowAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  orderId: z.string().min(1),
  orderKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  intentHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  evidenceDigest: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  evidenceId: z.string().min(1).max(200),
  supplierId: z.enum(['supplier_a', 'supplier_b']),
  occurredAt: z.string().datetime()
});

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'warn' } });
app.addHook('onRequest', async (request, reply) => {
  if (request.url === '/health') return;
  if (request.headers.authorization !== `Bearer ${serviceToken}`) return reply.code(401).send({ error: 'Unauthorized evidence request' });
});
app.get('/health', async () => ({ ok: true, signerConfigured: Boolean(process.env.EVIDENCE_SIGNER_PRIVATE_KEY) }));
app.post('/attestations/dispatch', async (request, reply) => {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  const input = parsed.data;
  const occurredAt = Date.parse(input.occurredAt);
  if (occurredAt > Date.now() + 30_000 || occurredAt < Date.now() - 60 * 60_000) return reply.code(409).send({ error: 'Dispatch timestamp is outside the attestation window' });
  const supplierResponse = await fetch(`${supplierUrls[input.supplierId]}/orders/${encodeURIComponent(input.orderId)}/status`, {
    headers: { Authorization: `Bearer ${supplierToken}` }, signal: AbortSignal.timeout(4_000)
  });
  if (!supplierResponse.ok) return reply.code(409).send({ error: 'Supplier dispatch could not be independently confirmed' });
  const supplier = await supplierResponse.json() as { status?: string; evidenceId?: string };
  if (supplier.status !== 'dispatched' || supplier.evidenceId !== input.evidenceId) return reply.code(409).send({ error: 'Supplier dispatch record does not match the submitted evidence' });
  if (!process.env.EVIDENCE_SIGNER_PRIVATE_KEY) return reply.code(503).send({ error: 'Evidence signer is not configured' });
  const signer = privateKeyToAccount(process.env.EVIDENCE_SIGNER_PRIVATE_KEY as Hex);
  const messageHash = keccak256(encodePacked(
    ['string', 'uint256', 'address', 'bytes32', 'bytes32', 'bytes32'],
    ['AFTERORDER_DISPATCH', BigInt(input.chainId), input.escrowAddress as Hex, input.orderKey as Hex, input.intentHash as Hex, input.evidenceDigest as Hex]
  ));
  const signature = await signer.signMessage({ message: { raw: messageHash } });
  return { signer: signer.address, signature, evidenceDigest: input.evidenceDigest, verifiedAt: new Date().toISOString() };
});

await app.listen({ port, host: '127.0.0.1' });
