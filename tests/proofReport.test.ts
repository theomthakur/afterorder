import { describe, expect, it } from 'vitest';
import { buildOrderProofReport } from '../apps/api/src/proofReport.ts';
import type { OrderSnapshot } from '../packages/shared/src/types.ts';

const order: OrderSnapshot = {
  id: 'order-1', shopifyOrderId: 'sandbox-order-1', displayOrder: '#AO-TEST', sku: 'AO-DESK-01',
  product: 'Walnut desk organizer', quantity: 1, retailTotal: 60, status: 'purchase_complete', mode: 'sandbox',
  selectedSupplier: 'Harbor Works', trackingNumber: 'HBR-123', createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:01:00.000Z',
  offers: [
    { id: 'a', supplierId: 'supplier_a', supplierName: 'Northstar Supply', total: 32, currency: 'DemoUSD', deliveryDays: 3, inStock: true, status: 'reservation_failed' },
    { id: 'b', supplierId: 'supplier_b', supplierName: 'Harbor Works', total: 35, currency: 'DemoUSD', deliveryDays: 4, inStock: true, status: 'accepted' }
  ],
  agents: [{ id: 'manager', name: 'Manager', status: 'complete', summary: 'Replanned safely', updatedAt: '2026-10-01T10:01:00.000Z' }],
  events: [{ id: 1, orderId: 'order-1', type: 'PlanRevised', message: 'Selected Harbor after reservation failure', actor: 'manager', createdAt: '2026-10-01T10:00:30.000Z', metadata: { previous: 'Northstar Supply' } }],
  reconciliation: { status: 'indexed', attempts: 1 },
  vault: { deposited: 500, available: 465, locked: 0, paid: 35, allowanceRemaining: 465 }
};

describe('order proof report', () => {
  it('labels sandbox evidence honestly and never links a synthetic transaction', () => {
    const sandboxHash = `0x${'b'.repeat(64)}`;
    const report = buildOrderProofReport(
      { ...order, chainTxHash: sandboxHash },
      { generatedAt: '2026-10-01T12:00:00.000Z', explorerUrl: 'https://testnet.monadexplorer.com/' },
    );
    expect(report).toContain('**Execution mode:** Local sandbox');
    expect(report).toContain('does not claim that tokens moved on a public network');
    expect(report).toContain(`${sandboxHash} (sandbox reference; not an onchain transaction)`);
    expect(report).not.toContain(`https://testnet.monadexplorer.com/tx/${sandboxHash}`);
    expect(report).toContain('| Northstar Supply | 32 DemoUSD | 3 days | reservation_failed | yes |');
    expect(report).toContain('Selected Harbor after reservation failure');
    expect(report).toContain('previous=Northstar Supply');
  });

  it('links a live transaction to the configured explorer', () => {
    const report = buildOrderProofReport({ ...order, mode: 'live_test', chainTxHash: `0x${'a'.repeat(64)}` }, { explorerUrl: 'https://testnet.monadexplorer.com/' });
    expect(report).toContain('**Execution mode:** Monad testnet live-test');
    expect(report).toContain(`https://testnet.monadexplorer.com/tx/0x${'a'.repeat(64)}`);
  });
});
