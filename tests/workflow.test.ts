import { describe, expect, it } from 'vitest';
import { startDemoSchema } from '../packages/shared/src/schemas.ts';
describe('demo input', () => { it('defaults to failover', () => expect(startDemoSchema.parse({}).scenario).toBe('supplier_failover')); it('rejects unknown scenario', () => expect(startDemoSchema.safeParse({scenario:'fake'}).success).toBe(false)); });
