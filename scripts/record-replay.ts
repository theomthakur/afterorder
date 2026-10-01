// Records one sandbox supplier-failover run so the command center can be hosted as a static replay.
import { writeFileSync } from 'node:fs';

const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:4100';
const health = await (await fetch(`${base}/api/health`)).json() as { mode: string };
if (health.mode !== 'sandbox') throw new Error('Record replays from sandbox mode only');
const started = await fetch(`${base}/api/demo/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: 'supplier_failover' }) });
if (!started.ok) throw new Error(`Demo start failed: ${started.status}`);
const { id } = await started.json() as { id: string };
const begin = Date.now();
const frames: Array<{ at: number; snapshot: unknown }> = [];
let lastUpdated = '';
while (Date.now() - begin < 30_000) {
  const order = await (await fetch(`${base}/api/orders/${id}`)).json() as { status: string; events: unknown[]; agents: unknown[] };
  const key = JSON.stringify([order.status, order.events.length, order.agents]);
  if (key !== lastUpdated) { frames.push({ at: Date.now() - begin, snapshot: order }); lastUpdated = key; }
  if (order.status === 'purchase_complete' || order.status === 'blocked') break;
  await new Promise((resolve) => setTimeout(resolve, 40));
}
const mandate = await (await fetch(`${base}/api/merchant/mandate/status`)).json() as { mandate: unknown };
writeFileSync('apps/web/public/replay.json', JSON.stringify({ recordedAt: new Date().toISOString(), mode: 'sandbox', mandate: mandate.mandate ?? null, frames }));
console.log(`Recorded ${frames.length} frames over ${frames.at(-1)?.at} ms`);
