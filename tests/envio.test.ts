import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyIndexedRelease } from '../apps/api/src/integrations/envio.ts';

describe('Envio release reconciliation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ENVIO_GRAPHQL_URL;
  });

  it('returns pending instead of throwing when the indexer is behind', async () => {
    process.env.ENVIO_GRAPHQL_URL = 'https://envio.invalid/graphql';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { OrderRelease: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const result = await verifyIndexedRelease('0xorder', '0xtransaction', { attempts: 1, delayMs: 0 });
    expect(result).toMatchObject({ verified: false, status: 'pending' });
  });

  it('reports a mismatched indexed transaction without changing payment truth', async () => {
    process.env.ENVIO_GRAPHQL_URL = 'https://envio.invalid/graphql';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { OrderRelease: [{ orderId: '0xorder', transactionHash: '0xother' }] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const result = await verifyIndexedRelease('0xorder', '0xtransaction', { attempts: 1, delayMs: 0 });
    expect(result).toMatchObject({ verified: false, status: 'mismatch' });
  });
});
