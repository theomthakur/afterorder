import { describe, expect, it } from 'vitest';
import { startDemoSchema } from '../packages/shared/src/schemas.ts';
import { automaticRetryDelay, shouldRetryAutomatically } from '../apps/api/src/retryPolicy.ts';

describe('demo input', () => { it('defaults to failover', () => expect(startDemoSchema.parse({}).scenario).toBe('supplier_failover')); it('rejects unknown scenario', () => expect(startDemoSchema.safeParse({scenario:'fake'}).success).toBe(false)); });

describe('autonomous retry policy', () => {
  it('retries bounded pre-payment work', () => {
    expect(shouldRetryAutomatically('source', 0)).toBe(true);
    expect(shouldRetryAutomatically('reserve', 1)).toBe(true);
    expect(shouldRetryAutomatically('reserve', 2)).toBe(false);
    expect(automaticRetryDelay(1)).toBeGreaterThan(automaticRetryDelay(0));
  });

  it('never blindly retries financial operations', () => {
    expect(shouldRetryAutomatically('fund', 0)).toBe(false);
    expect(shouldRetryAutomatically('release', 0)).toBe(false);
    expect(shouldRetryAutomatically('shopify', 0)).toBe(false);
  });
});
