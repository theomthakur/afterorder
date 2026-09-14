import { z } from 'zod';

export const startDemoSchema = z.object({
  scenario: z.enum(['supplier_failover', 'happy_path']).default('supplier_failover')
});

export const shopifyWebhookSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().optional(),
  financial_status: z.string().optional(),
  line_items: z.array(z.object({ sku: z.string().nullable().optional(), name: z.string(), quantity: z.number(), price: z.string() })).min(1)
});
