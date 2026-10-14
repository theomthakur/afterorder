import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PartnerStrip } from './Partners.tsx';
import { ArrowLeft, ArrowRight, Check, Maximize2, Minimize2 } from 'lucide-react';

type Slide = { label: string; eyebrow: string; title: ReactNode; body: ReactNode };

const SLIDES: Slide[] = [
  {
    label: 'Opening', eyebrow: 'MONAD METROPOLIS · AUTONOMOUS COMMERCE',
    title: <>The order is paid.<br/><span>AfterOrder handles what comes next.</span></>,
    body: <><p className="pitch-lede">Six agents source inventory, enforce merchant limits, secure supplier payment, coordinate dispatch and reconcile Shopify—while the merchant watches one live journey.</p><div className="pitch-metrics"><div><b>6</b><span>bounded agents</span></div><div><b>2</b><span>independent suppliers</span></div><div><b>1</b><span>merchant mandate</span></div></div></>
  },
  {
    label: 'Problem', eyebrow: '01 · THE OPERATIONAL GAP',
    title: 'A paid order can still become hours of manual coordination',
    body: <div className="pitch-columns"><section><b>Find stock</b><p>Compare suppliers, price and delivery without losing the order context.</p></section><section><b>Control spend</b><p>Keep every purchase inside a merchant-approved supplier and budget policy.</p></section><section><b>Close the loop</b><p>Connect reservation, payment, dispatch and Shopify fulfilment into one traceable record.</p></section></div>
  },
  {
    label: 'Agents', eyebrow: '02 · THE AGENT TEAM',
    title: 'One manager delegates; specialists own concrete work',
    body: <div className="agent-lanes"><div><b>Manager</b><span>Coordinates state and recovery</span></div><div><b>Sourcing</b><span>Requests and reserves offers</span></div><div><b>Policy</b><span>Enforces price and supplier limits</span></div><div><b>Logistics</b><span>Tracks delivery and dispatch</span></div><div><b>Purchasing</b><span>Funds and releases escrow</span></div><div><b>Reconciliation</b><span>Closes Shopify and payment records</span></div></div>
  },
  {
    label: 'Recovery', eyebrow: '03 · THE DEMO MOMENT',
    title: 'The cheapest supplier fails. The order does not.',
    body: <div className="recovery-flow"><div><small>FIRST CHOICE</small><b>Northstar · 32 DemoUSD</b><span>Reservation rejected: final unit gone</span></div><i>→</i><div className="decision"><small>MANAGER REPLANS</small><b>Policy stays unchanged</b><span>Under 40 DemoUSD · within five days</span></div><i>→</i><div className="success"><small>RECOVERED</small><b>Harbor Works · 35 DemoUSD</b><span>Reserved, dispatched and reconciled</span></div></div>
  },
  {
    label: 'Trust', eyebrow: '04 · WHY MONAD',
    title: 'The agent can act, but it cannot invent authority',
    body: <div className="trust-stack"><div><span>01</span><p><b>Mandate</b> defines the spend ceiling and approved suppliers.</p></div><div><span>02</span><p><b>Escrow</b> locks payment for the selected order intent.</p></div><div><span>03</span><p><b>Dispatch evidence</b> unlocks supplier payment.</p></div><div><span>04</span><p><b>Customer data stays offchain;</b> only authority and settlement need shared verification.</p></div></div>
  },
  {
    label: 'Architecture', eyebrow: '05 · SYSTEM ARCHITECTURE',
    title: 'External systems connect through validated action boundaries',
    body: <div className="mini-architecture"><div className="external">Shopify<br/><small>paid order</small></div><i>→</i><div className="core">AfterOrder API<br/><small>workflow · policy · event log</small></div><i>→</i><div className="external">Supplier APIs<br/><small>quote · reserve · dispatch</small></div><span>↓</span><div className="chain">Monad contracts<br/><small>mandate · escrow · release</small></div><span>↓</span><div className="surface">Live command center<br/><small>SSE snapshot · 3D agent floor</small></div></div>
  },
  {
    label: 'Live', eyebrow: '06 · LIVE ON MONAD TESTNET',
    title: 'A real Shopify order, settled on Monad, fulfilled in Shopify',
    body: <><p className="pitch-lede">Order #1001 on the afterorder-demo store fired a signed webhook. The Gemini planner picked Northstar, rerouted to Harbor Works when the reservation failed, and the escrow funded, accepted and released on Monad before Shopify marked the order fulfilled. The merchant mandate was signed from MetaMask through Dynamic.</p><PartnerStrip withRoles/></>
  },
  {
    label: 'Close', eyebrow: 'WHAT EXISTS TODAY',
    title: <>Autonomy that survives a failure<br/><span>and shows its work.</span></>,
    body: <><ul className="proof-list"><li><Check size={17}/>Complete persisted supplier-failover workflow</li><li><Check size={17}/>Authenticated supplier services with separate inventory</li><li><Check size={17}/>Monad mandate and escrow contracts with local-chain coverage</li><li><Check size={17}/>Verified Shopify webhook intake and fulfilment adapter</li><li><Check size={17}/>17 automated checks and a repeatable 15-event smoke flow</li></ul><p className="pitch-foot">github.com/theomthakur/afterorder</p></>
  }
];

export function Presentation() {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(SLIDES.length - 1, next))), []);
  const toggle = useCallback(() => document.fullscreenElement ? void document.exitFullscreen() : void shell.current?.requestFullscreen(), []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); setIndex((value) => Math.min(SLIDES.length - 1, value + 1)); }
      if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); setIndex((value) => Math.max(0, value - 1)); }
      if (event.key.toLowerCase() === 'f') toggle();
    };
    const full = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener('keydown', key); document.addEventListener('fullscreenchange', full);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('fullscreenchange', full); };
  }, [toggle]);
  const slide = SLIDES[index]!;
  return <div className={`pitch-shell ${fullscreen ? 'fullscreen' : ''}`} ref={shell}>
    <div className="pitch-toolbar"><span>{String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')} · {slide.label}</span><button onClick={toggle}>{fullscreen ? <Minimize2 size={15}/> : <Maximize2 size={15}/>} {fullscreen ? 'Exit' : 'Present'}</button></div>
    <article className={`pitch-slide ${index === 0 || index === SLIDES.length - 1 ? 'hero' : ''}`}><p className="pitch-eyebrow">{slide.eyebrow}</p><h2>{slide.title}</h2><div className="pitch-body">{slide.body}</div></article>
    <div className="pitch-controls"><button onClick={() => go(index - 1)} disabled={index === 0}><ArrowLeft size={16}/>Previous</button><div>{SLIDES.map((item, slideIndex) => <button key={item.label} aria-label={`Open ${item.label} slide`} className={index === slideIndex ? 'active' : ''} onClick={() => go(slideIndex)}/>)}</div><button onClick={() => go(index + 1)} disabled={index === SLIDES.length - 1}>Next<ArrowRight size={16}/></button></div>
  </div>;
}
