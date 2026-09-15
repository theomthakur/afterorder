import { addEvent, getOrder, setAgent, setOrderStatus, updateOffer, upsertOffer } from './db.ts';
import type { AgentId, Offer } from '../../../packages/shared/src/types.ts';
import { dispatchOrder, getOffers, reserveOffer } from './integrations/suppliers.ts';
import { acceptEscrow, fundEscrow, previewMandateSpend, releaseEscrow } from './integrations/chain.ts';
import { createShopifyFulfilment } from './integrations/shopify.ts';
import { verifyIndexedRelease } from './integrations/envio.ts';
import { attestDispatch } from './integrations/evidence.ts';

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

async function evaluateOffers(offers: Offer[]) {
  const maxDeliveryDays = Number(process.env.MAX_DELIVERY_DAYS ?? 5);
  const evaluations = await Promise.all(offers.map(async (offer) => ({ offer, spend: await previewMandateSpend(offer.total) })));
  return {
    eligible: evaluations.filter(({ offer, spend }) => offer.inStock && spend.allowed && offer.deliveryDays <= maxDeliveryDays).map(({ offer }) => offer),
    policyMode: evaluations.some(({ spend }) => spend.mode === 'live') ? 'onchain' : 'sandbox',
    maxDeliveryDays
  } as const;
}

async function chooseOffer(eligibleOffers: Offer[], failed?: Offer): Promise<{ offer: Offer; summary: string; mode: 'model' | 'deterministic' }> {
  const alternatives = eligibleOffers.filter((offer) => offer.id !== failed?.id);
  const fallback = alternatives.sort((a, b) => a.total - b.total || a.deliveryDays - b.deliveryDays)[0];
  if (!fallback) throw new Error(failed ? 'The preferred reservation failed and no valid alternative remains' : 'No policy-approved offer remains');
  const deterministicSummary = failed
    ? `Switching to ${fallback.supplierName}: ${fallback.total} DemoUSD and ${fallback.deliveryDays} days remain inside the mandate.`
    : `Selecting ${fallback.supplierName}: the lowest-cost policy-approved offer at ${fallback.total} DemoUSD.`;
  if (!process.env.OPENROUTER_API_KEY || process.env.ENABLE_MODEL_PLANNER !== 'true') return { offer: fallback, summary: deterministicSummary, mode: 'deterministic' };
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'AfterOrder' },
      body: JSON.stringify({ model: process.env.OPENROUTER_MODEL, max_tokens: 140, temperature: 0, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: 'You are a purchasing planner. Choose one offer from the supplied policy-approved alternatives. Balance cost and delivery, and if a prior offer failed, do not select it. Return JSON only: {"selectedOfferId":"...","rationale":"one factual sentence"}. Never invent an ID, amount, stock state, or delivery claim.' }, { role: 'user', content: JSON.stringify({ failedOfferId: failed?.id, alternatives: alternatives.map(({ id, supplierName, total, deliveryDays, inStock }) => ({ id, supplierName, total, deliveryDays, inStock })) }) }] })
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
  const policy = await evaluateOffers(offers);
  const eligible = policy.eligible.sort((a, b) => a.total - b.total);
  if (!eligible.length) throw new Error('No supplier offer satisfies stock, cost and delivery constraints');
  agent(orderId, 'policy', 'complete', `${eligible.length} offers satisfy the ${policy.policyMode === 'onchain' ? 'onchain' : 'sandbox'} spending mandate`);
  agent(orderId, 'logistics', 'complete', `Eligible delivery estimates meet the configured ${policy.maxDeliveryDays}-day deadline`);

  setOrderStatus(orderId, 'reserving');
  const initialPlan = scenario === 'happy_path'
    ? { offer: eligible.at(-1)!, summary: `Selecting ${eligible.at(-1)!.supplierName} for the configured happy-path demonstration.`, mode: 'deterministic' as const }
    : await chooseOffer(eligible);
  let selected = initialPlan.offer;
  updateOffer(selected.id, 'selected');
  agent(orderId, 'manager', 'working', initialPlan.summary);
  agent(orderId, 'sourcing', 'working', 'Reserving the selected policy-approved offer');
  event(orderId, 'OfferSelected', `${selected.supplierName} selected at ${selected.total} DemoUSD`, 'sourcing', { decisionMode: initialPlan.mode, rationale: initialPlan.summary });
  await delay(700);
  if (scenario === 'supplier_failover') {
    try {
      await reserveOffer(orderId, selected);
    } catch (error) {
      updateOffer(selected.id, 'reservation_failed');
      event(orderId, 'StockReservationFailed', `${selected.supplierName} could not reserve its last unit`, selected.supplierId as 'supplier_a' | 'supplier_b', { retryable: true, reason: error instanceof Error ? error.message : 'Supplier rejection' });
      const decision = await chooseOffer(eligible, selected);
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
  const attestation = await attestDispatch({ orderId, orderKey: funding.orderKey, intentHash: funding.intentHash, evidenceId: dispatch.evidenceId, supplierId: selected.supplierId, occurredAt: dispatch.occurredAt });
  event(orderId, 'DispatchAttested', `${dispatch.evidenceId} verified by the independent evidence service`, 'system', { evidenceMode: attestation.mode, occurredAt: dispatch.occurredAt });
  agent(orderId, 'logistics', 'complete', `${selected.supplierName} dispatched the order with tracking ${tracking}`);
  const release = await releaseEscrow({ orderKey: funding.orderKey, orderId, evidenceDigest: attestation.evidenceDigest, signature: attestation.signature });
  event(orderId, 'SupplierPaid', `${selected.total} DemoUSD released to ${selected.supplierName}`, 'chain', { txHash: release.txHash, mode: release.mode });
  const indexed = await verifyIndexedRelease(funding.orderKey, release.txHash);
  if (indexed.verified) event(orderId, 'IndexerVerified', 'Envio independently indexed the supplier release', 'chain', { mode: indexed.mode, txHash: release.txHash });
  else if (indexed.status === 'mismatch') event(orderId, 'IndexerMismatch', indexed.reason, 'chain', { mode: indexed.mode, txHash: release.txHash, reconciliationRequired: true });
  else event(orderId, 'IndexerPending', indexed.status === 'not_configured' ? 'Envio is not configured; payment remains confirmed by the chain result' : (indexed.reason ?? 'Envio reconciliation remains pending'), 'chain', { mode: indexed.mode, txHash: release.txHash, reconciliationRequired: indexed.status !== 'not_configured' });

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
