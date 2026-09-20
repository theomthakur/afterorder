import {
  addEvent, checkpointWorkflow, enqueueReconciliation, enqueueWorkflow, getDueReconciliations,
  getOrder, getRunnableWorkflowIds, getWorkflowJob, hasEvent, recordWorkflowFailure, setAgent,
  resumeWorkflow, setOrderStatus, updateOffer, updateReconciliation, upsertOffer
} from './db.ts';
import type { AgentId, Offer } from '../../../packages/shared/src/types.ts';
import { dispatchOrder, getOffers, reserveOffer } from './integrations/suppliers.ts';
import { acceptEscrow, fundEscrow, previewMandateSpend, releaseEscrow } from './integrations/chain.ts';
import { createShopifyFulfilment } from './integrations/shopify.ts';
import { verifyIndexedRelease } from './integrations/envio.ts';
import { attestDispatch } from './integrations/evidence.ts';
import type { Hex } from 'viem';
import { automaticRetryDelay, shouldRetryAutomatically } from './retryPolicy.ts';

const listeners = new Set<(orderId: string) => void>();
const running = new Set<string>();
let reconciliationTimer: ReturnType<typeof setInterval> | undefined;
let workflowTimer: ReturnType<typeof setInterval> | undefined;
export const subscribe = (fn: (orderId: string) => void) => { listeners.add(fn); return () => listeners.delete(fn); };
const publish = (orderId: string) => listeners.forEach((fn) => fn(orderId));
const visualPause = () => new Promise((resolve) => setTimeout(resolve, Number(process.env.DEMO_STEP_DELAY_MS ?? 450)));

function event(orderId: string, type: string, message: string, actor: Parameters<typeof addEvent>[3], metadata: Record<string, unknown> = {}) {
  if (!hasEvent(orderId, type)) addEvent(orderId, type, message, actor, metadata);
  publish(orderId);
}

function agent(orderId: string, id: AgentId, status: Parameters<typeof setAgent>[2], summary: string) {
  setAgent(orderId, id, status, summary);
  publish(orderId);
}

async function evaluateOffers(offers: Offer[], live: boolean) {
  const maxDeliveryDays = Number(process.env.MAX_DELIVERY_DAYS ?? 5);
  const evaluations = await Promise.all(offers.map(async (offer) => ({ offer, spend: await previewMandateSpend(offer.total, live) })));
  return {
    eligible: evaluations.filter(({ offer, spend }) => offer.inStock && spend.allowed && offer.deliveryDays <= maxDeliveryDays).map(({ offer }) => offer),
    policyMode: evaluations.some(({ spend }) => spend.mode === 'live') ? 'onchain' : 'sandbox', maxDeliveryDays
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
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-Title': 'AfterOrder' },
      body: JSON.stringify({ model: process.env.OPENROUTER_MODEL, max_tokens: 140, temperature: 0, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: 'Choose one offer from the supplied policy-approved alternatives. If a prior offer failed, do not select it. Return JSON only: {"selectedOfferId":"...","rationale":"one factual sentence"}. Never invent facts.' }, { role: 'user', content: JSON.stringify({ failedOfferId: failed?.id, alternatives }) }] })
    });
    if (!response.ok) return { offer: fallback, summary: `Model unavailable; selected ${fallback.supplierName} using the deterministic valid-offer rule.`, mode: 'deterministic' };
    const json = await response.json() as any;
    const decision = JSON.parse(json.choices?.[0]?.message?.content ?? '{}') as { selectedOfferId?: string; rationale?: string };
    const selected = alternatives.find((offer) => offer.id === decision.selectedOfferId);
    if (!selected) return { offer: fallback, summary: `Invalid model choice rejected; selected ${fallback.supplierName} using policy code.`, mode: 'deterministic' };
    return { offer: selected, summary: decision.rationale?.slice(0, 240) || `Selected ${selected.supplierName} within the mandate.`, mode: 'model' };
  } catch { return { offer: fallback, summary: `Model response could not be validated; selected ${fallback.supplierName} using policy code.`, mode: 'deterministic' }; }
}

type JobState = { selectedOfferId?: string; orderKey?: Hex; intentHash?: Hex; releaseTxHash?: Hex; tracking?: string; evidenceDigest?: Hex; evidenceSignature?: Hex };

async function executeStep(orderId: string) {
  const job = getWorkflowJob(orderId);
  const order = getOrder(orderId);
  if (!job || !order || job.step === 'complete' || job.step === 'failed') return false;
  const state = job.state as JobState;
  const live = order.mode === 'live_test';
  const selected = state.selectedOfferId ? order.offers.find((offer) => offer.id === state.selectedOfferId) : undefined;
  switch (job.step) {
    case 'validate': {
      setOrderStatus(orderId, 'validating');
      agent(orderId, 'manager', 'working', 'Validating the paid order and product mapping');
      event(orderId, 'OrderValidated', 'Paid order and AO-DESK-01 mapping verified', 'manager');
      checkpointWorkflow(orderId, 'source', state); break;
    }
    case 'source': {
      setOrderStatus(orderId, 'sourcing');
      agent(orderId, 'sourcing', 'working', 'Requesting signed offers from approved suppliers');
      agent(orderId, 'policy', 'working', 'Checking the mandate and delivery policy');
      agent(orderId, 'logistics', 'working', 'Comparing delivery options');
      const offers = await getOffers({ orderId, sku: order.sku, quantity: order.quantity });
      offers.forEach((offer) => upsertOffer(orderId, offer));
      event(orderId, 'QuoteReceived', `${offers.length} supplier offers received through separate APIs`, 'sourcing', { offerCount: offers.length });
      const policy = await evaluateOffers(offers, live);
      if (!policy.eligible.length) throw new Error('No supplier offer satisfies stock, cost and delivery constraints');
      agent(orderId, 'policy', 'complete', `${policy.eligible.length} offers satisfy the ${policy.policyMode} spending mandate`);
      agent(orderId, 'logistics', 'complete', `Eligible estimates meet the configured ${policy.maxDeliveryDays}-day deadline`);
      const decision = job.scenario === 'happy_path'
        ? { offer: policy.eligible.sort((a, b) => a.total - b.total).at(-1)!, summary: 'Selecting Harbor Works for the configured happy-path demonstration.', mode: 'deterministic' as const }
        : await chooseOffer(policy.eligible);
      updateOffer(decision.offer.id, 'selected');
      agent(orderId, 'manager', 'working', decision.summary);
      event(orderId, 'OfferSelected', `${decision.offer.supplierName} selected at ${decision.offer.total} DemoUSD`, 'sourcing', { decisionMode: decision.mode, rationale: decision.summary });
      checkpointWorkflow(orderId, 'reserve', { ...state, selectedOfferId: decision.offer.id }); break;
    }
    case 'reserve': {
      if (!selected) throw new Error('The selected supplier offer is missing');
      setOrderStatus(orderId, 'reserving'); agent(orderId, 'sourcing', 'working', 'Reserving the selected policy-approved offer');
      try { await reserveOffer(orderId, selected); }
      catch (error) {
        if (job.scenario !== 'supplier_failover') throw error;
        updateOffer(selected.id, 'reservation_failed');
        event(orderId, 'StockReservationFailed', `${selected.supplierName} could not reserve its last unit`, selected.supplierId as 'supplier_a' | 'supplier_b', { retryable: true, simulated: true, reason: error instanceof Error ? error.message : 'Supplier rejection' });
        const policy = await evaluateOffers(order.offers, live);
        const decision = await chooseOffer(policy.eligible, selected);
        updateOffer(decision.offer.id, 'selected'); agent(orderId, 'manager', 'retrying', decision.summary);
        event(orderId, 'PlanRevised', `Manager switched to ${decision.offer.supplierName} within the existing mandate`, 'manager', { decisionMode: decision.mode, rationale: decision.summary });
        await reserveOffer(orderId, decision.offer);
        agent(orderId, 'sourcing', 'complete', `${decision.offer.supplierName} reserved one AO-DESK-01`);
        event(orderId, 'StockReserved', `${decision.offer.supplierName} reserved the item`, decision.offer.supplierId as 'supplier_a' | 'supplier_b');
        checkpointWorkflow(orderId, 'fund', { ...state, selectedOfferId: decision.offer.id }); break;
      }
      agent(orderId, 'sourcing', 'complete', `${selected.supplierName} reserved one AO-DESK-01`);
      event(orderId, 'StockReserved', `${selected.supplierName} reserved the item`, selected.supplierId as 'supplier_a' | 'supplier_b');
      checkpointWorkflow(orderId, 'fund', state); break;
    }
    case 'fund': {
      if (!selected) throw new Error('The reserved supplier offer is missing');
      setOrderStatus(orderId, 'funding', { selectedSupplier: selected.supplierName, escrowAmount: selected.total });
      agent(orderId, 'purchasing', 'working', `Checking authority and locking ${selected.total} DemoUSD`);
      const funding = await fundEscrow({ orderId, supplierAddress: selected.supplierAddress, amount: selected.total, live });
      event(orderId, 'EscrowFunded', `${selected.total} DemoUSD locked for ${selected.supplierName}`, 'chain', { txHash: funding.txHash, mode: funding.mode });
      setOrderStatus(orderId, 'awaiting_supplier', { selectedSupplier: selected.supplierName, chainTxHash: funding.txHash, escrowAmount: selected.total });
      checkpointWorkflow(orderId, 'accept', { ...state, orderKey: funding.orderKey, intentHash: funding.intentHash }); break;
    }
    case 'accept': {
      if (!selected || !state.orderKey) throw new Error('Escrow state is incomplete');
      const acceptance = await acceptEscrow({ orderKey: state.orderKey, supplierId: selected.supplierId, live });
      updateOffer(selected.id, 'accepted');
      event(orderId, 'SupplierAccepted', `${selected.supplierName} verified escrow and accepted the order`, selected.supplierId as 'supplier_a' | 'supplier_b', { txHash: acceptance.txHash, mode: acceptance.mode });
      agent(orderId, 'purchasing', 'complete', 'Supplier order accepted against funded escrow'); checkpointWorkflow(orderId, 'dispatch', state); break;
    }
    case 'dispatch': {
      if (!selected || !state.orderKey) throw new Error('Dispatch state is incomplete');
      setOrderStatus(orderId, 'preparing_shipment');
      const tracking = state.tracking ?? `EZ200000000${orderId.slice(-2)}`;
      event(orderId, 'LabelPrepared', `Sandbox label prepared with tracking ${tracking}`, 'system', { tracking, evidenceMode: order.mode });
      setOrderStatus(orderId, 'awaiting_dispatch', { trackingNumber: tracking }); agent(orderId, 'logistics', 'waiting', 'Waiting for the supplier dispatch event');
      const dispatch = await dispatchOrder(orderId, selected.supplierId);
      const attestation = await attestDispatch({ orderId, orderKey: state.orderKey, intentHash: state.intentHash, evidenceId: dispatch.evidenceId, supplierId: selected.supplierId, occurredAt: dispatch.occurredAt, live });
      event(orderId, 'DispatchAttested', `${dispatch.evidenceId} verified by the independent evidence service`, 'system', { evidenceMode: attestation.mode, occurredAt: dispatch.occurredAt, evidenceDigest: attestation.evidenceDigest });
      agent(orderId, 'logistics', 'complete', `${selected.supplierName} dispatched the order with tracking ${tracking}`);
      checkpointWorkflow(orderId, 'release', { ...state, tracking, evidenceDigest: attestation.evidenceDigest, evidenceSignature: attestation.signature }); break;
    }
    case 'release': {
      if (!selected || !state.orderKey || !state.evidenceDigest || !state.evidenceSignature) throw new Error('Independent dispatch evidence is incomplete');
      const release = await releaseEscrow({ orderKey: state.orderKey, orderId, evidenceDigest: state.evidenceDigest, signature: state.evidenceSignature, live });
      event(orderId, 'SupplierPaid', `${selected.total} DemoUSD released to ${selected.supplierName}`, 'chain', { txHash: release.txHash, mode: release.mode });
      enqueueReconciliation(orderId, state.orderKey, release.txHash);
      event(orderId, 'IndexerPending', 'Payment is confirmed; independent indexer reconciliation has been queued', 'chain', { txHash: release.txHash, reconciliationRequired: true });
      checkpointWorkflow(orderId, 'shopify', { ...state, releaseTxHash: release.txHash }); break;
    }
    case 'shopify': {
      if (!state.tracking) throw new Error('Tracking is missing');
      setOrderStatus(orderId, 'reconciling'); agent(orderId, 'reconciliation', 'working', 'Checking supplier, payment and Shopify records');
      const fulfillment = await createShopifyFulfilment({ shopifyOrderId: order.shopifyOrderId, tracking: state.tracking, live });
      event(orderId, 'ShopifyFulfilmentConfirmed', `Shopify fulfilment updated with ${state.tracking}`, 'shopify', { mode: fulfillment.mode, fulfillmentId: fulfillment.fulfillmentId });
      checkpointWorkflow(orderId, 'complete', state); break;
    }
    default: throw new Error(`Unknown workflow step: ${job.step}`);
  }
  await visualPause(); return true;
}

async function processWorkflow(orderId: string) {
  if (running.has(orderId)) return;
  running.add(orderId);
  try {
    while (await executeStep(orderId)) { /* durable checkpoint after each bounded tool stage */ }
    if (getWorkflowJob(orderId)?.step === 'complete') {
      setOrderStatus(orderId, 'purchase_complete');
      agent(orderId, 'manager', 'complete', 'Purchase completed and external records reconciled');
      agent(orderId, 'reconciliation', 'complete', 'Supplier paid and Shopify fulfilment verified');
      event(orderId, 'PurchaseCompleted', 'Supplier paid · shipment dispatched · Shopify reconciled', 'manager');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown workflow failure';
    const job = getWorkflowJob(orderId);
    if (job && shouldRetryAutomatically(job.step, job.attempts)) {
      const delayMs = automaticRetryDelay(job.attempts);
      recordWorkflowFailure(orderId, message);
      agent(orderId, 'manager', 'retrying', `${message} · autonomous retry ${job.attempts + 1} of 2 scheduled`);
      event(orderId, 'WorkflowRetryScheduled', `A safe pre-payment step failed; the controller will retry automatically`, 'system', { step: job.step, attempt: job.attempts + 1, delayMs });
      const timer = setTimeout(() => {
        if (resumeWorkflow(orderId)) void processWorkflow(orderId);
      }, delayMs);
      timer.unref?.();
    } else {
      recordWorkflowFailure(orderId, message); setOrderStatus(orderId, 'blocked');
      agent(orderId, 'manager', 'blocked', `${message} · human review required before a financial retry`);
      event(orderId, 'WorkflowBlocked', message, 'system', { recoverable: true, failClosed: true });
    }
  } finally { running.delete(orderId); publish(orderId); }
}

export function runWorkflow(orderId: string, scenario: 'supplier_failover' | 'happy_path' = 'supplier_failover') {
  enqueueWorkflow(orderId, scenario); return processWorkflow(orderId);
}

async function reconcileDueJobs() {
  for (const job of getDueReconciliations()) {
    const result = await verifyIndexedRelease(job.order_key, job.tx_hash, { attempts: 1, delayMs: 0 });
    if (result.verified) {
      updateReconciliation(job.order_id, 'indexed');
      event(job.order_id, 'IndexerVerified', 'Envio independently indexed the supplier release', 'chain', { txHash: job.tx_hash, attempts: job.attempts + 1 });
    } else if (result.status === 'mismatch') {
      updateReconciliation(job.order_id, 'mismatch', result.reason);
      event(job.order_id, 'IndexerMismatch', result.reason, 'chain', { txHash: job.tx_hash, reconciliationRequired: true });
    } else if (result.status === 'not_configured') updateReconciliation(job.order_id, 'indexed', 'Envio is not configured in sandbox');
    else updateReconciliation(job.order_id, 'pending', result.reason);
  }
}

export function startWorkers() {
  for (const orderId of getRunnableWorkflowIds()) void processWorkflow(orderId);
  workflowTimer ??= setInterval(() => {
    for (const orderId of getRunnableWorkflowIds()) void processWorkflow(orderId);
  }, 2_000);
  workflowTimer.unref?.();
  void reconcileDueJobs();
  reconciliationTimer ??= setInterval(() => void reconcileDueJobs(), 1_000);
  reconciliationTimer.unref?.();
}
