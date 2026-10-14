// One live Monad testnet order through the real workflow (fund, accept, signed evidence, release).
// Shopify is not connected, so the final fulfilment step is expected to stop; every chain step is real.
import 'dotenv/config';
import crypto from 'node:crypto';
import { createOrder, getOrder } from '../apps/api/src/db.ts';
import { runWorkflow } from '../apps/api/src/workflow.ts';
import { chainIsLive } from '../apps/api/src/integrations/chain.ts';

if (!chainIsLive()) throw new Error('Monad contracts are not configured; run contracts:deploy first');
const id = crypto.randomUUID();
createOrder({ id, shopifyOrderId: `live-proof-${id}`, displayOrder: `#AO-LIVE-${id.slice(0, 4).toUpperCase()}`, sku: 'AO-DESK-01', product: 'Walnut desk organizer', quantity: 1, retailTotal: 60, mode: 'live_test' });
await runWorkflow(id, 'supplier_failover');
for (let i = 0; i < 120; i += 1) {
  const order = getOrder(id)!;
  if (['purchase_complete', 'blocked', 'failed'].includes(order.status) || order.events.some((e) => e.type === 'WorkflowBlocked')) break;
  await new Promise((r) => setTimeout(r, 1000));
}
const order = getOrder(id)!;
const explorer = process.env.MONAD_EXPLORER_URL ?? 'https://testnet.monadvision.com';
console.log(`Order ${order.displayOrder} (${id}) status=${order.status} mode=${order.mode}`);
for (const e of order.events) {
  const tx = (e.metadata as Record<string, unknown>)?.txHash as string | undefined;
  console.log(`${e.type.padEnd(28)} ${e.message}${tx ? `\n${' '.repeat(29)}${explorer.replace(/\/$/, '')}/tx/${tx}` : ''}`);
}
process.exit(0);
