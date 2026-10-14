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
const FLOW: Array<[string, string, Partner?]> = [
  ['Order paid', 'signed orders/paid webhook', 'Shopify'],
  ['Verify + record', 'signature check, no duplicates'],
  ['AI picks supplier', 'Gemini via OpenRouter, approved offers only', 'OpenRouter'],
  ['Reserve stock', 'cheapest fails, manager reroutes'],
  ['Lock payment', 'OrderEscrow.fundOrder', 'Monad'],
  ['Supplier ships', 'evidence signer verifies dispatch'],
  ['Release payment', 'OrderEscrow.releaseOnDispatch', 'Monad'],
  ['Mark fulfilled', 'tracking sent back + proof PDF', 'Shopify'],
];

export function SystemDesign() {
  return <div className="design-page">
    <header className="design-heading"><p>SYSTEM DESIGN</p><h1>Authority, execution and evidence stay separate</h1><span>AfterOrder gives agents room to recover while keeping money movement and external claims inside validated boundaries.</span></header>
    <section className="flow-board" aria-label="AfterOrder flow">
      <div className="flow-lane authority"><span className="lane-tag">BEFORE ANY ORDER</span>
        <div className="flow-node"><b><PartnerLogo name="Dynamic"/> Merchant connects wallet</b><small>MetaMask through Dynamic</small></div><i>→</i>
        <div className="flow-node chain"><b><PartnerLogo name="Monad"/> Mandate on Monad</b><small>per-order cap · total budget · approved suppliers</small></div>
      </div>
      <div className="flow-lane"><span className="lane-tag">EVERY PAID ORDER</span>
        {FLOW.map(([title, detail, logo], index) => <div className="flow-step" key={title}><div className={`flow-node ${logo === 'Monad' ? 'chain' : ''}`}><span>{index + 1}</span><b>{logo && <PartnerLogo name={logo}/>}{title}</b><small>{detail}</small></div>{index < FLOW.length - 1 && <i>→</i>}</div>)}
      </div>
    </section>

    <section className="design-section"><div className="design-section-title"><p>LIVE INTEGRATIONS</p><h2>Every external system is a real account, not a mock</h2></div><PartnerStrip withRoles/></section>

    <section className="design-section"><div className="design-section-title"><p>THE EXECUTION PATH</p><h2>One order moves through ten explicit states</h2></div><ol className="state-line">{['Received','Validate','Source','Reserve','Fund','Accept','Prepare','Dispatch','Reconcile','Complete'].map((state, index) => <li key={state}><span>{index + 1}</span><b>{state}</b></li>)}</ol></section>

    <section className="design-section"><div className="design-section-title"><p>CORE DESIGN DECISIONS</p><h2>The model proposes; trusted code commits</h2></div><div className="decision-list">{decisions.map(([title, copy], index) => <article key={title}><span>D{index + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}</div></section>

    <section className="design-split"><article><ShieldCheck/><div><p>POLICY BOUNDARY</p><h2>40 DemoUSD · five days · allowlisted suppliers</h2><span>Every recovery candidate is filtered before selection. The agent cannot trade delivery or price outside the merchant's mandate.</span></div></article><article><LockKeyhole/><div><p>PAYMENT BOUNDARY</p><h2>Dispatch evidence releases escrow</h2><span>The supplier accepts funded intent first. Payment releases only against the configured evidence signer and matching order intent.</span></div></article></section>

    <section className="design-section"><div className="design-section-title"><p>FAILURE MODEL</p><h2>The rejected path remains part of the record</h2></div><div className="failure-path"><div><RefreshCcw/><b>Reservation fails</b><span>Store the supplier rejection</span></div><i>→</i><div><ShieldCheck/><b>Re-evaluate</b><span>Filter the remaining offers</span></div><i>→</i><div><CheckCircle2/><b>Continue safely</b><span>Reserve without changing authority</span></div></div></section>
  </div>;
}
