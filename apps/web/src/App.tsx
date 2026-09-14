import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Activity, Bell, Box, Check, CircleDollarSign, Command, Minus, PackageCheck, Play, Plus, RotateCcw, ShieldCheck, Store } from 'lucide-react';
import type { AgentId, OrderSnapshot } from '../../../packages/shared/src/types.ts';
import { Scene } from './Scene.tsx';
const MerchantAccess = lazy(() => import('./MerchantAccess.tsx').then((module) => ({ default: module.MerchantAccess })));

const stages = ['received','validating','sourcing','reserving','funding','awaiting_supplier','preparing_shipment','awaiting_dispatch','reconciling','purchase_complete'];
const labels = ['Order','Validate','Offers','Reserve','Escrow','Supplier','Pack','Dispatch','Reconcile','Complete'];
const nav = [{ label: 'Command center', icon: Activity }, { label: 'Orders', icon: Box }, { label: 'Suppliers', icon: Store }, { label: 'Budget', icon: CircleDollarSign }, { label: 'Mandates', icon: ShieldCheck }];
type Health = { ok: boolean; mode: string; dependencies: { openrouter: boolean; monad: boolean; shopify: boolean; envio: boolean } };

function readable(value: string) { return value.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2'); }

export function App() {
  const [snapshot, setSnapshot] = useState<OrderSnapshot | null>(null);
  const [selected, setSelected] = useState<AgentId>('manager');
  const [starting, setStarting] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [zoom, setZoom] = useState(1);
  const [reset, setReset] = useState(0);
  const refresh = async () => { const response = await fetch('/api/orders/latest'); if (response.ok) setSnapshot(await response.json()); };
  useEffect(() => { void refresh(); void fetch('/api/health').then((response) => response.json()).then(setHealth); const events = new EventSource('/api/events'); events.addEventListener('order', () => void refresh()); return () => events.close(); }, []);
  const start = async () => { setStarting(true); const response = await fetch('/api/demo/start', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({scenario:'supplier_failover'}) }); if (response.ok) { await refresh(); setSelected('manager'); } setStarting(false); };
  const activeIndex = snapshot ? Math.max(0, stages.indexOf(snapshot.status)) : -1;
  const selectedAgent = useMemo(() => snapshot?.agents.find((agent) => agent.id === selected), [snapshot, selected]);
  const alert = [...(snapshot?.events ?? [])].reverse().find((item) => ['StockReservationFailed', 'PlanRevised', 'WorkflowBlocked', 'PurchaseCompleted'].includes(item.type));
  const completeAgents = snapshot?.agents.filter((agent) => agent.status === 'complete').length ?? 0;

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><img className="brand-mark" src="/afterorder-logo.svg" alt=""/><strong>After<span>Order</span></strong><i/><small>COMMERCE, IN MOTION</small></div>
      <div className="topbar-right">
        <span className={`network ${health?.dependencies.monad ? 'live' : ''}`}><i/>{health?.dependencies.monad ? 'MONAD TESTNET · LIVE' : 'LOCAL SANDBOX'}</span>
        <button className="icon-button notification-button" aria-label="Notifications"><Bell size={17}/>{alert && <i/>}</button><span className="topbar-divider"/>
        {import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID ? <Suspense fallback={<span className="wallet-loading">Wallet…</span>}><MerchantAccess/></Suspense> : <button className="avatar" aria-label="Sandbox merchant profile">OT</button>}
      </div>
    </header>
    <section className="layout">
      <aside className="rail" aria-label="Product navigation">
        {nav.map(({ label, icon: Icon }, index) => <button key={label} className={`rail-button ${index === 0 ? 'active' : ''}`} aria-label={label} title={label}><Icon size={18}/>{index === 0 && <i/>}</button>)}
        <span className="rail-line"/><button className="rail-button" aria-label="Agent control tower" title="Agent control tower"><Command size={18}/></button>
        <div className="rail-bottom"><span title="Supplier APIs connected"><i/></span></div>
      </aside>
      <section className="workspace">
        <div className="workspace-heading">
          <div><p className="breadcrumb">OPERATIONS <span>/</span> LIVE COMMAND FLOOR</p><div className="title-line"><h1>{snapshot ? `${snapshot.displayOrder} · ${snapshot.product}` : 'Commerce control tower'}</h1><span className="order-badge"><i/>{snapshot ? readable(snapshot.status) : 'ready'}</span></div><p>{snapshot ? `One ${snapshot.sku} · $${snapshot.retailTotal} Shopify test order` : 'Your agents are ready for the next paid order.'}</p></div>
          <button className="primary" onClick={start} disabled={starting || Boolean(snapshot && snapshot.status !== 'purchase_complete')}><Play size={15}/>{starting ? 'Starting…' : snapshot ? 'Run new order' : 'Start demo order'}</button>
        </div>
        <div className="order-strip">
          <span className="order-icon"><PackageCheck size={17}/></span><div><span>ACTIVE PURCHASE</span><strong>{snapshot ? `${snapshot.displayOrder} · ${snapshot.product}` : 'No order in progress'}</strong></div>
          <div className="order-metric"><span>SUPPLIER</span><strong>{snapshot?.selectedSupplier ?? 'Evaluating'}</strong></div>
          <div className="order-metric"><span>AGENTS</span><strong>{completeAgents} / {snapshot?.agents.length ?? 6} complete</strong></div>
          <div className="order-metric"><span>SPEND LIMIT</span><strong>40 DemoUSD</strong></div>
        </div>
        <div className="journey"><div className="journey-heading"><span>LIVE ORDER JOURNEY</span><small>{snapshot ? `${activeIndex + 1} / ${labels.length} · ${readable(snapshot.status)}` : 'Waiting for order'}</small></div><div className="journey-track">{labels.map((label, index) => <div key={label} className={`journey-step ${index <= activeIndex ? 'done' : ''} ${index === activeIndex ? 'current' : ''}`}><span>{index < activeIndex ? <Check size={10}/> : index + 1}</span><small>{label}</small></div>)}</div></div>
        <div className="scene-area">
          <div className="scene-caption"><i/> AUTONOMOUS OPERATIONS MAP <span>Select any station to inspect its work</span></div>
          {snapshot ? <Scene snapshot={snapshot} selected={selected} onSelect={setSelected} reset={reset} zoom={zoom}/> : <div className="empty"><div className="empty-orbit"><span>AO</span></div><h2>Agents standing by</h2><p>Start the supplier-failover scenario to activate the floor.</p><button className="primary" onClick={start}><Play size={15}/>Start supplier failover</button></div>}
          <div className="scene-legend"><span><i/>Working</span><span><i className="waiting"/>Monitoring</span><span><i className="complete"/>Complete</span></div>
          <div className="scene-controls"><button onClick={() => setZoom((value) => Math.max(.78, value - .1))} aria-label="Zoom out"><Minus size={14}/></button><span/><button onClick={() => { setZoom(1); setReset((value) => value + 1); }} aria-label="Reset view"><RotateCcw size={14}/></button><span/><button onClick={() => setZoom((value) => Math.min(1.35, value + .1))} aria-label="Zoom in"><Plus size={14}/></button></div>
        </div>
      </section>
      <aside className="context">
        <div className="context-eyebrow"><span>AGENT INSPECTOR</span><small>{snapshot?.agents.length ?? 6} desks</small></div>
        <div className="agent-profile"><span className={`agent-portrait ${selectedAgent?.status ?? 'idle'}`}><Command size={21}/><i/></span><div><p>{selected === 'manager' ? 'CONTROL TOWER' : 'SPECIALIST AGENT'}</p><h2>{selectedAgent?.name ?? 'Manager'}</h2></div><span className={`pill ${selectedAgent?.status ?? 'idle'}`}>{readable(selectedAgent?.status ?? 'idle')}</span></div>
        <p className="summary">{selectedAgent?.summary ?? 'Waiting for a paid Shopify order.'}</p>
        {alert && <div className={`notice ${alert.type === 'WorkflowBlocked' ? 'danger' : ''}`}><Bell size={14}/><div><strong>{readable(alert.type)}</strong><span>{alert.message}</span></div></div>}
        <div className="facts"><div><span>Selected supplier</span><strong>{snapshot?.selectedSupplier ?? 'Not selected'}</strong></div><div><span>Escrow state</span><strong>{snapshot?.vault.locked ? `${snapshot.vault.locked} locked` : snapshot?.vault.paid ? `${snapshot.vault.paid} paid` : 'Ready'}</strong></div><div><span>Tracking</span><strong>{snapshot?.trackingNumber ?? 'Not created'}</strong></div><div><span>Chain mode</span><strong>{health?.dependencies.monad ? 'Live testnet' : 'Sandbox'}</strong></div></div>
        <div className="section-title"><h3>Supplier offers</h3><span>{snapshot?.offers.length ?? 0}</span></div>
        <div className="offers">{snapshot?.offers.map((offer) => <div className={`offer ${offer.status}`} key={offer.id}><div><strong>{offer.supplierName}</strong><small>{offer.deliveryDays} business days</small></div><div><b>{offer.total}</b><small>DemoUSD</small></div><span>{readable(offer.status)}</span></div>) ?? <p className="muted">Offers appear when sourcing begins.</p>}</div>
        <div className="section-title"><h3>Live activity</h3><button className="text-btn" onClick={refresh}><RotateCcw size={13}/>Refresh</button></div>
        <div className="feed">{[...(snapshot?.events ?? [])].reverse().map((event) => <article key={event.id}><i/><div><p>{event.message}</p><small>{readable(event.actor)} · {new Date(event.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</small></div></article>)}</div>
      </aside>
    </section>
  </main>;
}
