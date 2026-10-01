import type { OrderSnapshot } from '../../../packages/shared/src/types.ts';

const clean = (value: unknown) => String(value ?? '—').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');

function metadataSummary(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? entries.map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : String(value)}`).join('; ') : '—';
}

export function buildOrderProofReport(order: OrderSnapshot, options: { generatedAt?: string; explorerUrl?: string } = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const isLive = order.mode === 'live_test';
  const transactionUrl = isLive && order.chainTxHash && options.explorerUrl
    ? `${options.explorerUrl.replace(/\/$/, '')}/tx/${order.chainTxHash}`
    : undefined;
  const settlementEvidence = transactionUrl
    ? `[${order.chainTxHash}](${transactionUrl})`
    : order.chainTxHash
      ? `${clean(order.chainTxHash)} (sandbox reference; not an onchain transaction)`
      : '—';
  const offers = order.offers.length
    ? order.offers.map((offer) => `| ${clean(offer.supplierName)} | ${offer.total} ${offer.currency} | ${offer.deliveryDays} days | ${clean(offer.status)} | ${offer.inStock ? 'yes' : 'no'} |`).join('\n')
    : '| — | — | — | — | — |';
  const agents = order.agents.map((agent) => `| ${clean(agent.name)} | ${clean(agent.status)} | ${clean(agent.summary)} |`).join('\n');
  const events = order.events.map((event, index) => `| ${index + 1} | ${clean(event.createdAt)} | ${clean(event.actor)} | ${clean(event.type)} | ${clean(event.message)} | ${clean(metadataSummary(event.metadata))} |`).join('\n');

  return `# AfterOrder execution proof

Generated: ${generatedAt}

## Run disclosure

- **Execution mode:** ${isLive ? 'Monad testnet live-test' : 'Local sandbox'}
- **Evidence boundary:** ${isLive ? 'Transaction identifiers below are intended to resolve on the configured Monad testnet explorer.' : 'This report proves the persisted orchestration and policy path only. It does not claim that tokens moved on a public network.'}
- **Order:** ${clean(order.displayOrder)} (${clean(order.id)})
- **Source order:** ${clean(order.shopifyOrderId)}
- **Status:** ${clean(order.status)}
- **Created:** ${clean(order.createdAt)}
- **Updated:** ${clean(order.updatedAt)}

## Purchase result

- **Product:** ${order.quantity} × ${clean(order.product)} (${clean(order.sku)})
- **Retail total:** ${order.retailTotal}
- **Selected supplier:** ${clean(order.selectedSupplier)}
- **Tracking:** ${clean(order.trackingNumber)}
- **Settlement transaction:** ${settlementEvidence}
- **Escrow:** ${order.vault.locked} locked · ${order.vault.paid} paid · ${order.vault.allowanceRemaining} authority remaining
- **Indexer:** ${order.reconciliation ? `${order.reconciliation.status} after ${order.reconciliation.attempts} check(s)${order.reconciliation.lastError ? ` · ${order.reconciliation.lastError}` : ''}` : 'not recorded'}

## Enforced trust boundaries

1. Supplier, price and delivery candidates are filtered before reservation.
2. The purchasing workflow cannot create its own independent dispatch attestation.
3. Escrow release is bound to the order intent and signed evidence.
4. Shopify intake and workflow operations are idempotent.
5. Indexer lag cannot rewrite confirmed payment state.
6. Sandbox and live-test execution never silently fall back into one another.

## Supplier decision record

| Supplier | Quote | Delivery | Outcome | Stock at quote |
|---|---:|---:|---|---|
${offers}

## Agent completion record

| Agent | State | Final summary |
|---|---|---|
${agents}

## Chronological proof trail

| # | Time | Actor | Event | Result | Metadata |
|---:|---|---|---|---|---|
${events || '| — | — | — | — | — | — |'}

## Verification note

This artifact is generated from the same persisted order snapshot used by the AfterOrder command center. It is an audit aid, not a production financial statement. Public-chain claims require a live-test run and independently resolvable explorer links.
`;
}
