import { PartnerLogo, PartnerStrip } from './Partners.tsx';
import { CheckCircle2, Database, LockKeyhole, Radio, RefreshCcw, ShieldCheck } from 'lucide-react';

const decisions = [
  ['Persist before acting', 'SQLite is authoritative. Every order, offer, agent state and event survives a refresh.'],
  ['Deterministic authority', 'Code enforces supplier, price and delivery limits. A model may explain a recovery, but cannot expand the mandate.'],
  ['Separate external truth', 'A quote is not a reservation, escrow is not dispatch, and a generated hash is never presented as a live transaction.'],
  ['Recover visibly', 'A failed reservation becomes an event, the rejected offer stays visible and the Manager selects another eligible supplier.'],
  ['Idempotent intake', 'Shopify webhook IDs are claimed once, so a platform retry cannot create a second purchase.'],
  ['Two honest modes', 'Sandbox runs end to end locally. Live-test activates only when the required external credentials and contracts exist.']
];

type Partner = 'Monad' | 'Shopify' | 'Dynamic' | 'MetaMask' | 'OpenRouter' | 'Gemini' | 'Envio';
type Card = { title: string; logo?: Partner; items: string[] };
const LAYERS: Array<{ index: string; name: string; note: string; cards: Card[] }> = [
  { index: 'L1', name: 'Entry points', note: 'who starts work', cards: [
    { title: 'Shopify store', logo: 'Shopify', items: ['orders/paid webhook, HMAC-SHA256 signed', 'one line item, SKU AO-DESK-01', 'Admin API: fulfilment + tracking'] },
    { title: 'Merchant wallet', logo: 'Dynamic', items: ['Dynamic login, MetaMask on Monad testnet', 'signs mint, approve, deposit, grantRoot', 'API verifies owner before activation'] },
    { title: 'Operator console', items: ['intro page, command center, slides', 'live state over Server-Sent Events', 'Run sandbox order, Proof PDF'] },
  ] },
  { index: 'L2', name: 'AfterOrder API', note: 'Fastify · validation boundary', cards: [
    { title: 'Intake', items: ['POST /webhooks/shopify/orders-paid', 'signature check on raw body', 'webhook ID claimed once (idempotent)'] },
    { title: 'Merchant authority', items: ['GET /api/merchant/mandate/config', 'POST /api/merchant/mandate/confirm', 'GET /api/merchant/mandate/status'] },
    { title: 'Orders + evidence', items: ['GET /api/orders/:id, /latest', 'POST /api/orders/:id/resume', 'GET /api/orders/:id/proof.md · /api/events'] },
  ] },
  { index: 'L3', name: 'Orchestration', note: 'restart-safe workflow', cards: [
    { title: 'Workflow engine', items: ['steps: validate, source, reserve, fund, accept, dispatch, release, shopify', 'checkpoint after every step', 'safe retries; money steps stop for review'] },
    { title: 'Agent team', items: ['Manager: plans and recovers', 'Sourcing, Policy, Purchasing', 'Logistics, Reconciliation'] },
    { title: 'Planner', logo: 'OpenRouter', items: ['OpenRouter → Gemini 2.5 Flash Lite', 'chooses only among policy-approved offers', 'invalid answer → deterministic rule'] },
  ] },
  { index: 'L4', name: 'Independent services', note: 'separate keys and state', cards: [
    { title: 'Supplier A · Northstar', items: ['POST /quotes, /reservations', '32 DemoUSD, last unit (fails on purpose)', 'own SQLite inventory'] },
    { title: 'Supplier B · Harbor Works', items: ['POST /quotes, /reservations', '35 DemoUSD, 10 units', 'own SQLite inventory'] },
    { title: 'Evidence signer', items: ['POST /attestations/dispatch', 're-checks supplier dispatch state', 'signs digest the escrow verifies'] },
  ] },
  { index: 'L5', name: 'Monad testnet', note: 'authority + settlement', cards: [
    { title: 'MandateRegistry', logo: 'Monad', items: ['grantRoot, delegate, revoke', 'previewSpend, consume, restore', 'per-order cap · total budget · supplier root'] },
    { title: 'OrderEscrow', logo: 'Monad', items: ['deposit, fundOrder', 'acceptOrder, releaseOnDispatch', 'refundExpired restores budget once'] },
    { title: 'DemoUSD', logo: 'Monad', items: ['mint, approve, transfer', 'valueless test token', 'chain 10143'] },
  ] },
  { index: 'L6', name: 'State + indexing', note: 'what is remembered', cards: [
    { title: 'SQLite event record', items: ['orders, agents, offers, events', 'workflow_jobs, reconciliation_jobs', 'operations, merchant_authorizations'] },
    { title: 'Envio HyperIndex', logo: 'Envio', items: ['OrderFunded, Accepted, Released, Refunded', 'independent check of each release', 'queued reconciliation with retries'] },
    { title: 'Outputs', items: ['Shopify order marked Fulfilled', 'proof report (PDF / Markdown)', 'monadvision transaction links'] },
  ] },
];
const SEQUENCE: Array<[string, string]> = [
  ['Merchant', 'Connects MetaMask through Dynamic and signs the mandate on Monad'],
  ['Shopify', 'Customer order is paid; Shopify sends the signed orders/paid webhook'],
  ['API', 'Verifies the signature, claims the webhook ID once, creates the order'],
  ['Sourcing', 'Requests quotes from Northstar and Harbor Works'],
  ['Policy', 'Drops any offer outside the mandate: supplier, price, delivery'],
  ['Manager', 'Gemini picks Northstar, the cheapest approved offer'],
  ['Sourcing', 'Northstar cannot reserve its last unit; the failure is recorded'],
  ['Manager', 'Replans: Harbor Works, still inside the same mandate'],
  ['Purchasing', 'fundOrder locks 35 DemoUSD in OrderEscrow on Monad'],
  ['Supplier', 'Harbor Works verifies the escrow and calls acceptOrder'],
  ['Logistics', 'Supplier dispatches; the evidence signer verifies and signs'],
  ['Escrow', 'releaseOnDispatch pays Harbor Works against the signed evidence'],
  ['Reconciliation', 'Shopify order marked Fulfilled with tracking; Envio check queued'],
  ['Operator', 'Downloads the proof report with every step and transaction link'],
];

export function SystemDesign() {
  return <div className="design-page">
    <header className="design-heading"><p>SYSTEM DESIGN</p><h1>Authority, execution and evidence stay separate</h1><span>AfterOrder gives agents room to recover while keeping money movement and external claims inside validated boundaries.</span></header>
    <section className="layered-arch" aria-label="AfterOrder detailed architecture">
      {LAYERS.map((layer) => <div className="layer" key={layer.name}>
        <div className="layer-name"><span>{layer.index}</span><b>{layer.name}</b><small>{layer.note}</small></div>
        <div className="layer-cards">{layer.cards.map((card) => <article key={card.title}><h4>{card.logo && <PartnerLogo name={card.logo}/>}{card.title}</h4><ul>{card.items.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div>
      </div>)}
    </section>

    <section className="design-section"><div className="design-section-title"><p>ONE LIVE ORDER, END TO END</p><h2>Fourteen steps from Shopify payment to Shopify fulfilment</h2></div>
      <ol className="sequence">{SEQUENCE.map(([actor, step], index) => <li key={step}><span>{index + 1}</span><b>{actor}</b><p>{step}</p></li>)}</ol>
    </section>

    <section className="design-section"><div className="design-section-title"><p>LIVE INTEGRATIONS</p><h2>Every external system is a real account, not a mock</h2></div><PartnerStrip withRoles/></section>

    <section className="design-section"><div className="design-section-title"><p>THE EXECUTION PATH</p><h2>One order moves through ten explicit states</h2></div><ol className="state-line">{['Received','Validate','Source','Reserve','Fund','Accept','Prepare','Dispatch','Reconcile','Complete'].map((state, index) => <li key={state}><span>{index + 1}</span><b>{state}</b></li>)}</ol></section>

    <section className="design-section"><div className="design-section-title"><p>CORE DESIGN DECISIONS</p><h2>The model proposes; trusted code commits</h2></div><div className="decision-list">{decisions.map(([title, copy], index) => <article key={title}><span>D{index + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div></section>

    <section className="design-split"><article><ShieldCheck/><div><p>POLICY BOUNDARY</p><h2>40 DemoUSD · five days · allowlisted suppliers</h2><span>Every recovery candidate is filtered before selection. The agent cannot trade delivery or price outside the merchant's mandate.</span></div></article><article><LockKeyhole/><div><p>PAYMENT BOUNDARY</p><h2>Dispatch evidence releases escrow</h2><span>The supplier accepts funded intent first. Payment releases only against the configured evidence signer and matching order intent.</span></div></article></section>

    <section className="design-section"><div className="design-section-title"><p>FAILURE MODEL</p><h2>The rejected path remains part of the record</h2></div><div className="failure-path"><div><RefreshCcw/><b>Reservation fails</b><span>Store the supplier rejection</span></div><i>→</i><div><ShieldCheck/><b>Re-evaluate</b><span>Filter the remaining offers</span></div><i>→</i><div><CheckCircle2/><b>Continue safely</b><span>Reserve without changing authority</span></div></div></section>
  </div>;
}
