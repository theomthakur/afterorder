import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type * as DbModule from '../apps/api/src/db.ts';

describe('durable workflow storage', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'afterorder-persistence-'));
  let store: typeof DbModule;
  const orderId = 'restart-test-order';

  beforeAll(async () => {
    process.env.DATABASE_PATH = path.join(directory, 'afterorder.db');
    store = await import('../apps/api/src/db.ts');
    store.createOrder({ id: orderId, shopifyOrderId: 'shopify-restart-test', displayOrder: '#RESTART', sku: 'AO-DESK-01', product: 'Desk organizer', quantity: 1, retailTotal: 60, mode: 'sandbox' });
  });

  afterAll(() => {
    store.db.close();
    fs.rmSync(directory, { recursive: true, force: true });
    delete process.env.DATABASE_PATH;
  });

  it('keeps one job and restores its checkpoint payload', () => {
    store.enqueueWorkflow(orderId, 'supplier_failover');
    store.enqueueWorkflow(orderId, 'happy_path');
    store.checkpointWorkflow(orderId, 'accept', { selectedOfferId: 'offer-2', orderKey: '0x1234' });
    expect(store.getRunnableWorkflowIds()).toEqual([orderId]);
    expect(store.getWorkflowJob(orderId)).toMatchObject({
      orderId, scenario: 'supplier_failover', step: 'accept', state: { selectedOfferId: 'offer-2', orderKey: '0x1234' }
    });
  });

  it('pauses a failed job until an explicit resume', () => {
    store.recordWorkflowFailure(orderId, 'supplier unavailable');
    expect(store.getRunnableWorkflowIds()).not.toContain(orderId);
    expect(store.getWorkflowJob(orderId)).toMatchObject({ attempts: 1, lastError: 'supplier unavailable' });
    expect(store.resumeWorkflow(orderId)).toBe(true);
    expect(store.getRunnableWorkflowIds()).toContain(orderId);
    expect(store.getWorkflowJob(orderId)?.lastError).toBeUndefined();
  });

  it('persists supplier context required after restart', () => {
    store.upsertOffer(orderId, {
      id: 'offer-2', supplierId: 'supplier_b', supplierName: 'Harbor Works', total: 35,
      currency: 'DemoUSD', deliveryDays: 4, inStock: true, status: 'selected', quoteId: 'quote-2',
      expiresAt: '2026-09-15T12:00:00.000Z', supplierAddress: '0x0000000000000000000000000000000000000002'
    });
    expect(store.getOrder(orderId)?.offers[0]).toMatchObject({
      quoteId: 'quote-2', expiresAt: '2026-09-15T12:00:00.000Z', supplierAddress: '0x0000000000000000000000000000000000000002'
    });
  });

  it('persists reconciliation attempts separately from payment state', () => {
    store.enqueueReconciliation(orderId, '0xorder', '0xtx');
    store.updateReconciliation(orderId, 'pending', 'indexer behind');
    expect(store.getOrder(orderId)?.reconciliation).toMatchObject({ status: 'pending', attempts: 1, lastError: 'indexer behind' });
  });
});
