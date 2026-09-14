import 'dotenv/config';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const id = z.enum(['supplier_a', 'supplier_b']).parse(process.env.SUPPLIER_ID);
const name = process.env.SUPPLIER_NAME ?? id;
const port = Number(process.env.SUPPLIER_PORT ?? (id === 'supplier_a' ? 4201 : 4202));
const price = Number(process.env.SUPPLIER_PRICE ?? (id === 'supplier_a' ? 32 : 35));
const deliveryDays = Number(process.env.SUPPLIER_DAYS ?? (id === 'supplier_a' ? 3 : 4));
const serviceToken = process.env.SUPPLIER_SERVICE_TOKEN ?? 'afterorder-local-demo-only';
const dbPath = path.resolve(`./data/${id}.db`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (sku TEXT PRIMARY KEY, available INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, sku TEXT NOT NULL, quantity INTEGER NOT NULL, expires_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE, quote_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
`);
db.prepare('INSERT OR IGNORE INTO inventory VALUES (?, ?)').run('AO-DESK-01', Number(process.env.SUPPLIER_INITIAL_STOCK ?? (id === 'supplier_a' ? 0 : 10)));

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'warn' } });
app.addHook('onRequest', async (request, reply) => {
  if (request.url === '/health') return;
  if (request.headers.authorization !== `Bearer ${serviceToken}`) return reply.code(401).send({ error: 'Unauthorized supplier call' });
});
app.get('/health', async () => ({ ok: true, id, name }));

const quoteSchema = z.object({ orderId: z.string().min(1), sku: z.literal('AO-DESK-01'), quantity: z.number().int().positive().max(10) });
app.post('/quotes', async (request, reply) => {
  const parsed = quoteSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  const quoteId = crypto.createHash('sha256').update(`${id}:${parsed.data.orderId}:${parsed.data.sku}:${parsed.data.quantity}`).digest('hex').slice(0, 24);
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  db.prepare('INSERT OR REPLACE INTO quotes VALUES (?, ?, ?, ?, ?)').run(quoteId, parsed.data.orderId, parsed.data.sku, parsed.data.quantity, expiresAt);
  const available = (db.prepare('SELECT available FROM inventory WHERE sku=?').get(parsed.data.sku) as { available: number } | undefined)?.available ?? 0;
  return { id, name, quoteId, total: price, currency: 'DemoUSD', deliveryDays, inStock: available >= parsed.data.quantity, expiresAt };
});

const reserveSchema = z.object({ orderId: z.string(), quoteId: z.string(), idempotencyKey: z.string() });
app.post('/reservations', async (request, reply) => {
  const parsed = reserveSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
  const existing = db.prepare('SELECT * FROM reservations WHERE order_id=?').get(parsed.data.orderId) as { id: string; status: string } | undefined;
  if (existing) return { reservationId: existing.id, status: existing.status };
  const quote = db.prepare('SELECT * FROM quotes WHERE id=? AND order_id=?').get(parsed.data.quoteId, parsed.data.orderId) as { sku: string; quantity: number; expires_at: string } | undefined;
  if (!quote || Date.parse(quote.expires_at) <= Date.now()) return reply.code(409).send({ code: 'QUOTE_INVALID', message: 'Quote missing or expired' });
  if (process.env.SUPPLIER_FAIL_RESERVATIONS === 'true') {
    return reply.code(409).send({ code: 'OUT_OF_STOCK', message: 'A competing reservation took the final unit' });
  }
  const update = db.prepare('UPDATE inventory SET available=available-? WHERE sku=? AND available>=?').run(quote.quantity, quote.sku, quote.quantity);
  if (update.changes !== 1) return reply.code(409).send({ code: 'OUT_OF_STOCK', message: 'Inventory could not be reserved' });
  const reservationId = crypto.createHash('sha256').update(parsed.data.idempotencyKey).digest('hex').slice(0, 24);
  db.prepare('INSERT INTO reservations VALUES (?, ?, ?, ?, ?)').run(reservationId, parsed.data.orderId, parsed.data.quoteId, 'reserved', new Date().toISOString());
  return { reservationId, status: 'reserved' };
});

app.post<{ Params: { orderId: string } }>('/orders/:orderId/dispatch', async (request, reply) => {
  const reservation = db.prepare('SELECT * FROM reservations WHERE order_id=?').get(request.params.orderId) as { id: string } | undefined;
  if (!reservation) return reply.code(404).send({ error: 'Reservation not found' });
  db.prepare("UPDATE reservations SET status='dispatched' WHERE order_id=?").run(request.params.orderId);
  return { status: 'dispatched', evidenceId: `dispatch-${reservation.id}`, occurredAt: new Date().toISOString() };
});

await app.listen({ port, host: '127.0.0.1' });
