export {};

const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:4100';
const health = await fetch(`${base}/api/health`);
if (!health.ok) throw new Error(`API health failed: ${health.status}`);
const started = await fetch(`${base}/api/demo/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario: 'supplier_failover' }) });
if (!started.ok) throw new Error(`Demo start failed: ${started.status}`);
const { id } = await started.json() as { id: string };
const deadline = Date.now() + 15_000;
while (Date.now() < deadline) {
  const response = await fetch(`${base}/api/orders/${id}`);
  const order = await response.json() as { status: string; events: Array<{ type: string }>; selectedSupplier?: string; agents: Array<{ name: string; status: string }> };
  if (order.status === 'blocked') throw new Error('Workflow entered blocked state');
  if (order.status === 'purchase_complete') {
    const expected = ['StockReservationFailed', 'PlanRevised', 'EscrowFunded', 'DispatchAttested', 'SupplierPaid', 'ShopifyFulfilmentConfirmed', 'PurchaseCompleted'];
    for (const type of expected) if (!order.events.some((event) => event.type === type)) throw new Error(`Missing event ${type}`);
    if (order.selectedSupplier !== 'Harbor Works') throw new Error('Workflow did not reroute to Harbor Works');
    const unfinished = order.agents.filter((agent) => agent.status !== 'complete');
    if (unfinished.length) throw new Error(`Completed workflow has unfinished agents: ${unfinished.map((agent) => `${agent.name}:${agent.status}`).join(', ')}`);
    console.log(`Smoke test passed for ${id}: ${order.events.length} events, autonomous supplier failover complete.`);
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
throw new Error('Workflow did not complete before timeout');
