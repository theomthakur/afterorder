import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fundEscrow, previewMandateSpend } from '../apps/api/src/integrations/chain.ts';
import { createShopifyFulfilment } from '../apps/api/src/integrations/shopify.ts';

const keys = [
  'MONAD_RPC_URL', 'PURCHASER_PRIVATE_KEY', 'ORDER_ESCROW_ADDRESS', 'MANDATE_REGISTRY_ADDRESS',
  'SETTLEMENT_TOKEN_ADDRESS', 'SUPPLIER_A_WALLET', 'SUPPLIER_B_WALLET',
  'SUPPLIER_A_PRIVATE_KEY', 'SUPPLIER_B_PRIVATE_KEY', 'MANDATE_ID',
  'SHOPIFY_SHOP_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'
] as const;
const saved = new Map<string, string | undefined>();

describe('sandbox and live execution boundaries', () => {
  beforeEach(() => {
    for (const key of keys) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    saved.clear();
  });

  it('keeps sandbox policy and settlement deterministic even without credentials', async () => {
    await expect(previewMandateSpend(35, false)).resolves.toMatchObject({ mode: 'sandbox', allowed: true });
    await expect(fundEscrow({ orderId: 'sandbox-order', amount: 35, live: false })).resolves.toMatchObject({ mode: 'sandbox' });
    await expect(createShopifyFulfilment({ shopifyOrderId: 'sandbox-order', tracking: 'DEMO-1', live: false })).resolves.toMatchObject({ mode: 'sandbox' });
  });

  it('fails closed instead of simulating a live order when credentials are missing', async () => {
    await expect(previewMandateSpend(35, true)).rejects.toThrow('Live mandate policy is not fully configured');
    await expect(fundEscrow({ orderId: 'live-order', amount: 35, live: true })).rejects.toThrow('Live Monad settlement is not fully configured');
    await expect(createShopifyFulfilment({ shopifyOrderId: 'live-order', tracking: 'LIVE-1', live: true })).rejects.toThrow('Live Shopify fulfilment is not fully configured');
  });
});
