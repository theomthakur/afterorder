import type { Offer } from '../../../../packages/shared/src/types.ts';

type SupplierId = 'supplier_a' | 'supplier_b';
const configs: Array<{ id: SupplierId; url: string; wallet?: `0x${string}` }> = [
  { id: 'supplier_a', url: process.env.SUPPLIER_A_URL ?? 'http://127.0.0.1:4201', wallet: process.env.SUPPLIER_A_WALLET as `0x${string}` | undefined },
  { id: 'supplier_b', url: process.env.SUPPLIER_B_URL ?? 'http://127.0.0.1:4202', wallet: process.env.SUPPLIER_B_WALLET as `0x${string}` | undefined }
];
const headers = () => ({ Authorization: `Bearer ${process.env.SUPPLIER_SERVICE_TOKEN ?? 'afterorder-local-demo-only'}`, 'Content-Type': 'application/json' });

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(4_000) });
  if (!response.ok) {
    const error = new Error(`Supplier returned ${response.status}`) as Error & { status: number; body: unknown };
    error.status = response.status;
    error.body = await response.json().catch(() => ({}));
    throw error;
  }
  return response.json() as Promise<T>;
}

export async function resetDemoSuppliers() {
  await Promise.all(configs.map((supplier) => request<{ ok: boolean }>(`${supplier.url}/demo/reset`, {
    method: 'POST', headers: headers(), body: '{}'
  })));
}

export async function getOffers(input: { orderId: string; sku: string; quantity: number }): Promise<Offer[]> {
  return Promise.all(configs.map(async (supplier) => {
    const result = await request<{ name: string; quoteId: string; total: number; deliveryDays: number; inStock: boolean; expiresAt: string }>(`${supplier.url}/quotes`, {
      method: 'POST', headers: headers(), body: JSON.stringify(input)
    });
    return { id: `${input.orderId}-${supplier.id}`, supplierId: supplier.id, supplierName: result.name, total: result.total, currency: 'DemoUSD', deliveryDays: result.deliveryDays, inStock: result.inStock, status: 'quoted', quoteId: result.quoteId, expiresAt: result.expiresAt, supplierAddress: supplier.wallet };
  }));
}

export async function reserveOffer(orderId: string, offer: Offer) {
  const supplier = configs.find((item) => item.id === offer.supplierId);
  if (!supplier || !offer.quoteId) throw new Error('Supplier or quote is missing');
  return request<{ reservationId: string; status: string }>(`${supplier.url}/reservations`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ orderId, quoteId: offer.quoteId, idempotencyKey: `reserve:${orderId}:${offer.quoteId}` })
  });
}

export async function dispatchOrder(orderId: string, supplierId: string) {
  const supplier = configs.find((item) => item.id === supplierId);
  if (!supplier) throw new Error('Supplier is missing');
  return request<{ status: string; evidenceId: string; occurredAt: string }>(`${supplier.url}/orders/${orderId}/dispatch`, { method: 'POST', headers: headers(), body: '{}' });
}
