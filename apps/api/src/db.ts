import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { agentDefaults, type AgentId, type AgentState, type Offer, type OrderEvent, type OrderSnapshot, type WorkflowStatus } from '../../../packages/shared/src/types.ts';

const databasePath = path.resolve(process.env.DATABASE_PATH ?? './data/afterorder.db');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
export const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, shopify_order_id TEXT NOT NULL UNIQUE, display_order TEXT NOT NULL,
    sku TEXT NOT NULL, product TEXT NOT NULL, quantity INTEGER NOT NULL, retail_total INTEGER NOT NULL,
    status TEXT NOT NULL, mode TEXT NOT NULL, selected_supplier TEXT, tracking_number TEXT,
    chain_tx_hash TEXT, escrow_amount INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS agents (
    order_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL,
    summary TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(order_id, id),
    FOREIGN KEY(order_id) REFERENCES orders(id)
  );
  CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY, order_id TEXT NOT NULL, supplier_id TEXT NOT NULL, supplier_name TEXT NOT NULL,
    total INTEGER NOT NULL, delivery_days INTEGER NOT NULL, in_stock INTEGER NOT NULL, status TEXT NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id)
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, type TEXT NOT NULL, message TEXT NOT NULL,
    actor TEXT NOT NULL, created_at TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY(order_id) REFERENCES orders(id)
  );
  CREATE TABLE IF NOT EXISTS operations (
    key TEXT PRIMARY KEY, request_hash TEXT NOT NULL, result TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS merchant_authorizations (
    address TEXT PRIMARY KEY, message TEXT NOT NULL, signature TEXT NOT NULL, verified_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS merchant_authorization_challenges (
    nonce TEXT PRIMARY KEY, address TEXT NOT NULL, message TEXT NOT NULL,
    expires_at TEXT NOT NULL, used_at TEXT
  );
`);
try { db.exec('ALTER TABLE orders ADD COLUMN escrow_amount INTEGER NOT NULL DEFAULT 0'); } catch { /* already migrated */ }

const now = () => new Date().toISOString();
export function createOrder(input: { id: string; shopifyOrderId: string; displayOrder: string; sku: string; product: string; quantity: number; retailTotal: number; mode: 'sandbox' | 'live_test' }) {
  const timestamp = now();
  db.prepare(`INSERT INTO orders (id,shopify_order_id,display_order,sku,product,quantity,retail_total,status,mode,selected_supplier,tracking_number,chain_tx_hash,escrow_amount,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ?, ?)`).run(
    input.id, input.shopifyOrderId, input.displayOrder, input.sku, input.product, input.quantity,
    input.retailTotal, 'received', input.mode, timestamp, timestamp
  );
  const insertAgent = db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?)');
  for (const agent of agentDefaults) insertAgent.run(input.id, agent.id, agent.name, 'idle', 'Waiting for work', timestamp);
  addEvent(input.id, 'OrderReceived', `${input.displayOrder} entered from Shopify`, 'shopify', { sku: input.sku });
}

export function setOrderStatus(orderId: string, status: WorkflowStatus, patch: { selectedSupplier?: string; trackingNumber?: string; chainTxHash?: string; escrowAmount?: number } = {}) {
  const current = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown> | undefined;
  if (!current) throw new Error('Order not found');
  db.prepare(`UPDATE orders SET status=?, selected_supplier=?, tracking_number=?, chain_tx_hash=?, escrow_amount=?, updated_at=? WHERE id=?`).run(
    status,
    patch.selectedSupplier ?? current.selected_supplier,
    patch.trackingNumber ?? current.tracking_number,
    patch.chainTxHash ?? current.chain_tx_hash,
    patch.escrowAmount ?? current.escrow_amount,
    now(), orderId
  );
}

export function setAgent(orderId: string, id: AgentId, status: AgentState['status'], summary: string) {
  db.prepare('UPDATE agents SET status=?, summary=?, updated_at=? WHERE order_id=? AND id=?').run(status, summary, now(), orderId, id);
}

export function upsertOffer(orderId: string, offer: Offer) {
  db.prepare(`INSERT INTO offers VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET in_stock=excluded.in_stock, status=excluded.status`).run(
    offer.id, orderId, offer.supplierId, offer.supplierName, offer.total, offer.deliveryDays, offer.inStock ? 1 : 0, offer.status
  );
}

export function updateOffer(id: string, status: Offer['status']) { db.prepare('UPDATE offers SET status=? WHERE id=?').run(status, id); }

export function addEvent(orderId: string, type: string, message: string, actor: OrderEvent['actor'], metadata: Record<string, unknown> = {}) {
  const result = db.prepare('INSERT INTO events (order_id,type,message,actor,created_at,metadata) VALUES (?,?,?,?,?,?)')
    .run(orderId, type, message, actor, now(), JSON.stringify(metadata));
  return Number(result.lastInsertRowid);
}

export function getLatestOrder(): OrderSnapshot | null {
  const row = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 1').get() as any;
  return row ? hydrate(row) : null;
}

export function getOrder(id: string): OrderSnapshot | null {
  const row = db.prepare('SELECT * FROM orders WHERE id=?').get(id) as any;
  return row ? hydrate(row) : null;
}

export function getOrderByShopifyId(shopifyOrderId: string): OrderSnapshot | null {
  const row = db.prepare('SELECT * FROM orders WHERE shopify_order_id=?').get(shopifyOrderId) as any;
  return row ? hydrate(row) : null;
}

export function claimOperation(key: string, requestHash: string): boolean {
  const result = db.prepare('INSERT OR IGNORE INTO operations (key,request_hash,created_at) VALUES (?,?,?)').run(key, requestHash, now());
  return result.changes === 1;
}

export function saveMerchantAuthorization(address: string, message: string, signature: string) {
  db.prepare(`INSERT INTO merchant_authorizations VALUES (?,?,?,?)
    ON CONFLICT(address) DO UPDATE SET message=excluded.message, signature=excluded.signature, verified_at=excluded.verified_at`)
    .run(address.toLowerCase(), message, signature, now());
}

export function createMerchantAuthorizationChallenge(address: string, message: string, nonce: string, expiresAt: string) {
  db.prepare('INSERT INTO merchant_authorization_challenges (nonce,address,message,expires_at,used_at) VALUES (?,?,?,?,NULL)')
    .run(nonce, address.toLowerCase(), message, expiresAt);
}

export function consumeMerchantAuthorizationChallenge(nonce: string, address: string, message: string) {
  const result = db.prepare(`UPDATE merchant_authorization_challenges SET used_at=?
    WHERE nonce=? AND address=? AND message=? AND used_at IS NULL AND expires_at>?`)
    .run(now(), nonce, address.toLowerCase(), message, now());
  return result.changes === 1;
}

function hydrate(row: any): OrderSnapshot {
  const offers = (db.prepare('SELECT * FROM offers WHERE order_id=? ORDER BY total').all(row.id) as any[]).map((o) => ({
    id: o.id, supplierId: o.supplier_id, supplierName: o.supplier_name, total: o.total,
    currency: 'DemoUSD' as const, deliveryDays: o.delivery_days, inStock: Boolean(o.in_stock), status: o.status
  }));
  const agents = (db.prepare('SELECT * FROM agents WHERE order_id=?').all(row.id) as any[]).map((a) => ({
    id: a.id, name: a.name, status: a.status, summary: a.summary, updatedAt: a.updated_at
  }));
  const events = (db.prepare('SELECT * FROM events WHERE order_id=? ORDER BY id').all(row.id) as any[]).map((e) => ({
    id: e.id, orderId: e.order_id, type: e.type, message: e.message, actor: e.actor,
    createdAt: e.created_at, metadata: JSON.parse(e.metadata)
  }));
  const amount = Number(row.escrow_amount ?? 0);
  const locked = ['funding', 'awaiting_supplier', 'preparing_shipment', 'awaiting_dispatch', 'reconciling'].includes(row.status) ? amount : 0;
  const paid = row.status === 'purchase_complete' ? amount : 0;
  return {
    id: row.id, shopifyOrderId: row.shopify_order_id, displayOrder: row.display_order,
    sku: row.sku, product: row.product, quantity: row.quantity, retailTotal: row.retail_total,
    status: row.status, mode: row.mode, selectedSupplier: row.selected_supplier ?? undefined,
    trackingNumber: row.tracking_number ?? undefined, chainTxHash: row.chain_tx_hash ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at, offers, agents, events,
    vault: { deposited: 500, available: 500 - locked - paid, locked, paid, allowanceRemaining: 500 - (locked + paid) }
  };
}
