import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyShopifyWebhook } from '../apps/api/src/integrations/shopifyWebhook.ts';

describe('Shopify webhook verification', () => {
  const raw = JSON.stringify({ id: 42, line_items: [{ sku: 'AO-DESK-01' }] });
  const secret = 'test-only-secret';

  it('accepts the exact signed bytes', () => {
    const signature = crypto.createHmac('sha256', secret).update(raw).digest('base64');
    expect(verifyShopifyWebhook(raw, signature, secret)).toBe(true);
  });

  it('rejects changed content and malformed signatures', () => {
    const signature = crypto.createHmac('sha256', secret).update(raw).digest('base64');
    expect(verifyShopifyWebhook(`${raw} `, signature, secret)).toBe(false);
    expect(verifyShopifyWebhook(raw, 'not-a-signature', secret)).toBe(false);
  });
});
