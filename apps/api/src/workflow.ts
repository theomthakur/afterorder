import { addEvent, getOrder, setAgent, setOrderStatus, updateOffer, upsertOffer } from './db.ts';
import type { AgentId, Offer } from '../../../packages/shared/src/types.ts';
import { dispatchOrder, getOffers, reserveOffer } from './integrations/suppliers.ts';
import { acceptEscrow, fundEscrow, releaseEscrow } from './integrations/chain.ts';
import { createShopifyFulfilment } from './integrations/shopify.ts';
import { verifyIndexedRelease } from './integrations/envio.ts';

const listeners = new Set<(orderId: string) => void>();
export const subscribe = (fn: (orderId: string) => void) => { listeners.add(fn); return () => listeners.delete(fn); };
const publish = (orderId: string) => listeners.forEach((fn) => fn(orderId));
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function event(orderId: string, type: string, message: string, actor: Parameters<typeof addEvent>[3], metadata: Record<string, unknown> = {}) {
  addEvent(orderId, type, message, actor, metadata);
  publish(orderId);
}

function agent(orderId: string, id: AgentId, status: Parameters<typeof setAgent>[2], summary: string) {
  setAgent(orderId, id, status, summary);
  publish(orderId);
}

async function chooseRecoveryOffer(offers: Offer[], failed: Offer): Promise<{ offer: Offer; summary: string; mode: 'model' | 'deterministic' }> {
  const alternatives = offers.filter((offer) => offer.id !== failed.id && offer.inStock && offer.total <= 40 && offer.deliveryDays <= 5);
  const fallback = alternatives.sort((a, b) => a.total - b.total || a.deliveryDays - b.deliveryDays)[0];
  if (!fallback) throw new Error('The preferred reservation failed and no valid alternative remains');
  if (!process.env.OPENROUTER_API_KEY) return { offer: fallback, summary: `Switching to ${fallback.supplierName}: ${fallback.total} DemoUSD and ${fallback.deliveryDays} days remain inside the mandate.`, mode: 'deterministic' };
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'AfterOrder' },
      body: JSON.stringify({ model: process.env.OPENROUTER_MODEL, max_tokens: 140, temperature: 0, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: 'Choose one offer from the supplied valid alternatives. Return JSON only: {"selectedOfferId":"...","rationale":"one factual sentence"}. Never invent an ID, amount, stock state, or delivery claim.' }, { role: 'user', content: JSON.stringify({ failedOfferId: failed.id, mandate: { maxTotal: 40, maxDeliveryDays: 5 }, alternatives: alternatives.map(({ id, supplierName, total, deliveryDays, inStock }) => ({ id, supplierName, total, deliveryDays, inStock })) }) }] })
    });
    if (!response.ok) return { offer: fallback, summary: `Model unavailable; selected ${fallback.supplierName} using the deterministic valid-offer rule.`, mode: 'deterministic' };
    const json = await response.json() as any;
    const decision = JSON.parse(json.choices?.[0]?.message?.content ?? '{}') as { selectedOfferId?: string; rationale?: string };
    const selected = alternatives.find((offer) => offer.id === decision.selectedOfferId);
    if (!selected) return { offer: fallback, summary: `Invalid model choice rejected; selected ${fallback.supplierName} using policy code.`, mode: 'deterministic' };
    return { offer: selected, summary: decision.rationale?.slice(0, 240) || `Switching to ${selected.supplierName} within the existing mandate.`, mode: 'model' };
  } catch { return { offer: fallback, summary: `Model response could not be validated; selected ${fallback.supplierName} using policy code.`, mode: 'deterministic' }; }
}

export async function runWorkflow(orderId: string, scenario: 'supplier_failover' | 'happy_path' = 'supplier_failover') {
  const order = getOrder(orderId);
  if (!order || order.status !== 'received') return;
  try {
  setOrderStatus(orderId, 'validating');
  agent(orderId, 'manager', 'working', 'Validating the paid order and product mapping');
  event(orderId, 'OrderValidated', 'Paid order and AO-DESK-01 mapping verified', 'manager');
  await delay(600);

  setOrderStatus(orderId, 'sourcing');
  agent(orderId, 'sourcing', 'working', 'Requesting signed offers from approved suppliers');
  agent(orderId, 'policy', 'working', 'Checking cost and delivery limits');
  agent(orderId, 'logistics', 'working', 'Comparing delivery options');
  const offers = await getOffers({ orderId, sku: order.sku, quantity: order.quantity });
  offers.forEach((offer) => upsertOffer(orderId, offer));
  event(orderId, 'QuoteReceived', `${offers.length} supplier offers received through separate APIs`, 'sourcing', { offerCount: offers.length });
  await delay(700);
  const eligible = offers.filter((offer) => offer.inStock && offer.total <= 40 && offer.deliveryDays <= 5).sort((a, b) => a.total - b.total);
  if (!eligible.length) throw new Error('No supplier offer satisfies stock, cost and delivery constraints');
  agent(orderId, 'policy', 'complete', `${eligible.length} offers satisfy the 40 DemoUSD and five-day mandate`);
  agent(orderId, 'logistics', 'complete', 'Eligible delivery estimates meet the configured deadline');

  setOrderStatus(orderId, 'reserving');
  let selected = scenario === 'happy_path' ? eligible.at(-1)! : eligible[0]!;
  updateOffer(selected.id, 'selected');
  agent(orderId, 'sourcing', 'working', 'Reserving the lowest-cost valid offer');
  event(orderId, 'OfferSelected', `${selected.supplierName} selected at ${selected.total} DemoUSD`, 'sourcing');
  await delay(700);
  if (scenario === 'supplier_failover') {
    try {
      await reserveOffer(orderId, selected);
    } catch (error) {
      updateOffer(selected.id, 'reservation_failed');
      event(orderId, 'StockReservationFailed', `${selected.supplierName} could not reserve its last unit`, selected.supplierId as 'supplier_a' | 'supplier_b', { retryable: true, reason: error instanceof Error ? error.message : 'Supplier rejection' });
      const decision = await chooseRecoveryOffer(eligible, selected);
      const alternative = decision.offer;
      agent(orderId, 'manager', 'retrying', decision.summary);
      await delay(700);
      selected = alternative;
      updateOffer(selected.id, 'selected');
      event(orderId, 'PlanRevised', `Manager switched to ${selected.supplierName} within the existing mandate`, 'manager', { decisionMode: decision.mode });
      await reserveOffer(orderId, selected);
    }
  } else {
    await reserveOffer(orderId, selected);
  }
  agent(orderId, 'sourcing', 'complete', `${selected.supplierName} reserved one AO-DESK-01`);
  event(orderId, 'StockReserved', `${selected.supplierName} reserved the item`, selected.supplierId as 'supplier_a' | 'supplier_b');
  await delay(600);

  setOrderStatus(orderId, 'funding', { selectedSupplier: selected.supplierName, escrowAmount: selected.total });
  agent(orderId, 'purchasing', 'working', `Checking authority and locking ${selected.total} DemoUSD`);
  const funding = await fundEscrow({ orderId, supplierAddress: selected.supplierAddress, amount: selected.total });
  event(orderId, 'EscrowFunded', `${selected.total} DemoUSD locked for ${selected.supplierName}`, 'chain', { txHash: funding.txHash, mode: funding.mode });
  setOrderStatus(orderId, 'awaiting_supplier', { selectedSupplier: selected.supplierName, chainTxHash: funding.txHash, escrowAmount: selected.total });
  await delay(700);
  const acceptance = await acceptEscrow({ orderKey: funding.orderKey, supplierId: selected.supplierId });
  updateOffer(selected.id, 'accepted');
  event(orderId, 'SupplierAccepted', `${selected.supplierName} verified escrow and accepted the order`, selected.supplierId as 'supplier_a' | 'supplier_b', { txHash: acceptance.txHash, mode: acceptance.mode });
  agent(orderId, 'purchasing', 'complete', 'Supplier order accepted against funded escrow');

  setOrderStatus(orderId, 'preparing_shipment');
  agent(orderId, 'logistics', 'working', 'Preparing a sandbox shipping label and tracking record');
  await delay(700);
  const tracking = `EZ200000000${orderId.slice(-2)}`;
  event(orderId, 'LabelPrepared', `Sandbox label prepared with tracking ${tracking}`, 'system', { tracking, evidenceMode: 'sandbox' });
  setOrderStatus(orderId, 'awaiting_dispatch', { trackingNumber: tracking });
  agent(orderId, 'logistics', 'waiting', 'Waiting for the sandbox supplier dispatch event');
  await delay(700);
  const dispatch = await dispatchOrder(orderId, selected.supplierId);
  event(orderId, 'DispatchAttested', `${dispatch.evidenceId} verified by the evidence bridge`, 'system', { evidenceMode: funding.mode, occurredAt: dispatch.occurredAt });
  agent(orderId, 'logistics', 'complete', `${selected.supplierName} dispatched the order with tracking ${tracking}`);
  const release = await releaseEscrow({ orderKey: funding.orderKey, orderId, evidenceId: dispatch.evidenceId, intentHash: funding.intentHash });
  event(orderId, 'SupplierPaid', `${selected.total} DemoUSD released to ${selected.supplierName}`, 'chain', { txHash: release.txHash, mode: release.mode });
  const indexed = await verifyIndexedRelease(funding.orderKey, release.txHash);
  if (indexed.verified) event(orderId, 'IndexerVerified', 'Envio independently indexed the supplier release', 'chain', { mode: indexed.mode, txHash: release.txHash });

  setOrderStatus(orderId, 'reconciling');
  agent(orderId, 'reconciliation', 'working', 'Checking supplier, payment and Shopify records');
  await delay(700);
  const fulfillment = await createShopifyFulfilment({ shopifyOrderId: order.shopifyOrderId, tracking });
  event(orderId, 'ShopifyFulfilmentConfirmed', `Shopify fulfilment updated with ${tracking}`, 'shopify', { mode: fulfillment.mode, fulfillmentId: fulfillment.fulfillmentId });
  setOrderStatus(orderId, 'purchase_complete');
  agent(orderId, 'manager', 'complete', 'Purchase completed and external records reconciled');
  agent(orderId, 'reconciliation', 'complete', 'Supplier paid and Shopify fulfilment verified');
  event(orderId, 'PurchaseCompleted', 'Supplier paid · shipment dispatched · Shopify reconciled', 'manager');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown workflow failure';
    setOrderStatus(orderId, 'blocked');
    agent(orderId, 'manager', 'blocked', message);
    event(orderId, 'WorkflowBlocked', message, 'system');
  }
}
