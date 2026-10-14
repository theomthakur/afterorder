import { ArrowRight, FileCheck2, RotateCcw, ShieldCheck } from 'lucide-react';
import { PartnerStrip } from './Partners.tsx';

export function Landing({ onEnter }: { onEnter: () => void }) {
  return <main className="landing">
    <nav className="landing-nav"><div className="brand"><img className="brand-mark" src="/afterorder-logo.svg" alt=""/><strong>After<span>Order</span></strong></div><button className="landing-cta small" onClick={onEnter}>Try it out <ArrowRight size={15}/></button></nav>
    <section className="landing-hero">
      <p className="landing-eyebrow">MONAD METROPOLIS · TRUST, IDENTITY &amp; AI INFRASTRUCTURE</p>
      <h1>The order is paid.<br/><span>Your agents handle the rest, within limits you set onchain.</span></h1>
      <p className="landing-lede">AfterOrder turns a paid Shopify order into a bounded supplier purchase. A manager agent and five specialists source offers, apply your rules, lock payment in a Monad escrow, recover when a supplier fails and mark the order fulfilled in Shopify.</p>
      <div className="landing-actions"><button className="landing-cta" onClick={onEnter}>Try it out <ArrowRight size={16}/></button><a href="#presentation" onClick={onEnter}>See the 2-minute story</a></div>
    </section>
    <section className="landing-pillars">
      <article><ShieldCheck/><h3>Authority you sign</h3><p>Connect your wallet with Dynamic and create an onchain mandate: per-order cap, total budget and approved suppliers. Agents cannot exceed it.</p></article>
      <article><RotateCcw/><h3>Recovery without a human</h3><p>When the cheapest supplier cannot reserve stock, the AI manager reroutes to the next approved offer inside the same mandate.</p></article>
      <article><FileCheck2/><h3>Payment tied to evidence</h3><p>Escrow releases only after a verifier you chose signs that the goods shipped. Every order exports a proof report.</p></article>
    </section>
    <section className="landing-partners"><p>LIVE INTEGRATIONS</p><PartnerStrip withRoles/></section>
    <footer className="landing-foot">Running on Monad testnet · open source (MIT) · github.com/theomthakur/afterorder</footer>
  </main>;
}
