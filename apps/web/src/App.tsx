import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Activity, Bell, Check, ChevronRight, Command, FileCheck2, Minus, PackageCheck, Play, Plus, Presentation as PresentationIcon, RotateCcw, ShieldCheck, Workflow, X } from 'lucide-react';
import type { AgentId, OrderSnapshot } from '../../../packages/shared/src/types.ts';
import { Scene } from './Scene.tsx';
import { Presentation } from './Presentation.tsx';
import { SystemDesign } from './SystemDesign.tsx';
const MerchantAccess = lazy(() => import('./MerchantAccess.tsx').then((module) => ({ default: module.MerchantAccess })));

const stages = ['received','validating','sourcing','reserving','funding','awaiting_supplier','preparing_shipment','awaiting_dispatch','reconciling','purchase_complete'];
const labels = ['Order','Validate','Offers','Reserve','Escrow','Supplier','Pack','Dispatch','Reconcile','Complete'];
type View = 'command' | 'presentation' | 'system-design';
const nav: Array<{ view: View; label: string; icon: typeof Activity }> = [
  { view: 'command', label: 'Command center', icon: Activity },
  { view: 'presentation', label: 'Presentation', icon: PresentationIcon },
  { view: 'system-design', label: 'System design', icon: Workflow }
];
type Health = { ok: boolean; mode: string; dependencies: { openrouter: boolean; monad: boolean; shopify: boolean; envio: boolean } };
type MandateStatus = { maxPerOrder: string; maxCumulative: string; allocated: string; remaining: string; expiresAt: string; revoked: boolean };

const autonomousLanes: Array<{ id: AgentId; action: string }> = [
  { id: 'manager', action: 'Plan' },
  { id: 'sourcing', action: 'Source' },
  { id: 'policy', action: 'Authorize' },
  { id: 'purchasing', action: 'Settle' },
  { id: 'logistics', action: 'Verify' },
  { id: 'reconciliation', action: 'Close' }
];

function readable(value: string) { return value.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2'); }

export function App() {
  const [view, setView] = useState<View>(() => window.location.hash === '#presentation' ? 'presentation' : window.location.hash === '#system-design' ? 'system-design' : 'command');
  const [snapshot, setSnapshot] = useState<OrderSnapshot | null>(null);
  const [selected, setSelected] = useState<AgentId>('manager');
  const [starting, setStarting] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [mandate, setMandate] = useState<MandateStatus | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [followAgents, setFollowAgents] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [reset, setReset] = useState(0);
  const refresh = async () => {
    const [orderResponse, mandateResponse] = await Promise.all([fetch('/api/orders/latest'), fetch('/api/merchant/mandate/status')]);
    if (orderResponse.ok) setSnapshot(await orderResponse.json());
    if (mandateResponse.ok) setMandate((await mandateResponse.json()).mandate ?? null);
  };
  useEffect(() => { void refresh(); void fetch('/api/health').then((response) => response.json()).then(setHealth); const events = new EventSource('/api/events'); events.addEventListener('order', () => void refresh()); return () => events.close(); }, []);
  useEffect(() => { const onHash = () => setView(window.location.hash === '#presentation' ? 'presentation' : window.location.hash === '#system-design' ? 'system-design' : 'command'); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  useEffect(() => {
    if (!followAgents || !snapshot) return;
    const next = snapshot.agents.find((agent) => ['retrying', 'blocked'].includes(agent.status))
      ?? snapshot.agents.find((agent) => agent.status === 'working')
      ?? snapshot.agents.find((agent) => agent.status === 'waiting');
    if (next) setSelected(next.id);
  }, [followAgents, snapshot?.updatedAt]);
  const openView = (next: View) => { window.location.hash = next === 'command' ? '' : next; setView(next); };
  const start = async () => { setStarting(true); const response = await fetch('/api/demo/start', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({scenario:'supplier_failover'}) }); if (response.ok) { await refresh(); setSelected('manager'); } setStarting(false); };
  const resume = async () => { if (!snapshot) return; setStarting(true); const response = await fetch(`/api/orders/${snapshot.id}/resume`, { method: 'POST' }); if (response.ok) await refresh(); setStarting(false); };
  const activeIndex = snapshot ? Math.max(0, stages.indexOf(snapshot.status)) : -1;
  const selectedAgent = useMemo(() => snapshot?.agents.find((agent) => agent.id === selected), [snapshot, selected]);
  const alert = [...(snapshot?.events ?? [])].reverse().find((item) => ['StockReservationFailed', 'PlanRevised', 'WorkflowBlocked', 'PurchaseCompleted'].includes(item.type));
  const completeAgents = snapshot?.agents.filter((agent) => agent.status === 'complete').length ?? 0;
  const notifications = [...(snapshot?.events ?? [])].reverse().filter((item) => ['StockReservationFailed', 'PlanRevised', 'EscrowFunded', 'DispatchAttested', 'SupplierPaid', 'IndexerVerified', 'WorkflowBlocked', 'PurchaseCompleted'].includes(item.type)).slice(0, 7);
  const isComplete = snapshot?.status === 'purchase_complete';
  const isBlocked = snapshot?.status === 'blocked';

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><img className="brand-mark" src="/afterorder-logo.svg" alt=""/><strong>After<span>Order</span></strong><i/><small>COMMERCE, IN MOTION</small></div>
      <div className="topbar-right">
        <span className={`network ${health?.dependencies.monad ? 'live' : ''}`}><i/>{health?.dependencies.monad ? 'MONAD TESTNET · LIVE' : 'LOCAL SANDBOX'}</span>
        <button className={`icon-button notification-button ${notificationsOpen ? 'active' : ''}`} aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((value) => !value)}><Bell size={17}/>{alert && <i/>}</button><span className="topbar-divider"/>
        {import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID ? <Suspense fallback={<span className="wallet-loading">Wallet…</span>}><MerchantAccess/></Suspense> : <button className="avatar" aria-label="Sandbox merchant profile">OT</button>}
      </div>
      {notificationsOpen && <section className="notification-drawer" aria-label="Agent notifications">
        <div className="notification-head"><div><span>AGENT NOTIFICATIONS</span><strong>{snapshot ? `${notifications.length} material updates` : 'No active order'}</strong></div><button onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={15}/></button></div>
        {notifications.length ? <div className="notification-list">{notifications.map((item) => <article key={item.id}><span className={`notification-symbol ${item.type === 'WorkflowBlocked' ? 'danger' : item.type === 'PurchaseCompleted' ? 'complete' : ''}`}>{item.type === 'PurchaseCompleted' ? <Check size={12}/> : <Activity size={12}/>}</span><div><strong>{readable(item.type)}</strong><p>{item.message}</p><small>{readable(item.actor)} · {new Date(item.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</small></div></article>)}</div> : <p className="notification-empty">Start an order and material agent decisions will appear here.</p>}
      </section>}
    </header>
    <section className={`layout ${view !== 'command' ? 'explain-mode' : ''}`}>
      <aside className="rail" aria-label="Product navigation">
        {nav.map(({ view: destination, label, icon: Icon }) => <button key={label} onClick={() => openView(destination)} className={`rail-button ${view === destination ? 'active' : ''}`} aria-label={label} title={label}><Icon size={18}/>{view === destination && <i/>}</button>)}
        <div className="rail-bottom"><span title="Supplier APIs connected"><i/></span></div>
      </aside>
      {view === 'command' ? <><section className="workspace">
        <div className="workspace-heading">
          <div><p className="breadcrumb">OPERATIONS <span>/</span> LIVE COMMAND FLOOR</p><div className="title-line"><h1>{snapshot ? `${snapshot.displayOrder} · ${snapshot.product}` : 'Commerce control tower'}</h1><span className="order-badge"><i/>{snapshot ? readable(snapshot.status) : 'ready'}</span></div><p>{snapshot ? `One ${snapshot.sku} · $${snapshot.retailTotal} Shopify test order` : 'Your agents are ready for the next paid order.'}</p></div>
          <button className="primary" onClick={start} disabled={starting || Boolean(snapshot && snapshot.status !== 'purchase_complete')}><Play size={15}/>{starting ? 'Starting…' : snapshot ? 'Run new order' : 'Start demo order'}</button>
        </div>
        <section className="autonomy-strip" aria-label="Autonomous execution plan">
          <div className="autonomy-intro"><span><Command size={13}/> AUTONOMOUS EXECUTION</span><strong>One order in. Six agents finish the work.</strong><small>Humans set the mandate; agents operate inside it.</small></div>
          <div className="autonomy-lanes">{autonomousLanes.map((lane, index) => {
            const state = snapshot?.agents.find((agent) => agent.id === lane.id)?.status ?? 'idle';
            return <div className={`autonomy-lane ${state}`} key={lane.id}><span>{state === 'complete' ? <Check size={10}/> : index + 1}</span><div><small>{lane.action}</small><strong>{snapshot?.agents.find((agent) => agent.id === lane.id)?.name ?? readable(lane.id)}</strong></div>{index < autonomousLanes.length - 1 && <ChevronRight size={12}/>}</div>;
          })}</div>
        </section>
        <div className="order-strip">
          <span className="order-icon"><PackageCheck size={17}/></span><div><span>ACTIVE PURCHASE</span><strong>{snapshot ? `${snapshot.displayOrder} · ${snapshot.product}` : 'No order in progress'}</strong></div>
          <div className="order-metric"><span>SUPPLIER</span><strong>{snapshot?.selectedSupplier ?? 'Evaluating'}</strong></div>
          <div className="order-metric"><span>AGENTS</span><strong>{completeAgents} / {snapshot?.agents.length ?? 6} complete</strong></div>
          <div className="order-metric"><span>SPEND LIMIT</span><strong>{mandate?.maxPerOrder ?? '40'} DemoUSD</strong></div>
        </div>
        <div className="journey"><div className="journey-heading"><span>LIVE ORDER JOURNEY</span><small>{snapshot ? `${activeIndex + 1} / ${labels.length} · ${readable(snapshot.status)}` : 'Waiting for order'}</small></div><div className="journey-track">{labels.map((label, index) => <div key={label} className={`journey-step ${index <= activeIndex ? 'done' : ''} ${index === activeIndex ? 'current' : ''}`}><span>{index < activeIndex ? <Check size={10}/> : index + 1}</span><small>{label}</small></div>)}</div></div>
        {(isComplete || isBlocked) && <section className={`workflow-outcome ${isBlocked ? 'blocked' : 'complete'}`}>
          <span>{isComplete ? <FileCheck2 size={19}/> : <ShieldCheck size={19}/>}</span>
          <div><small>{isComplete ? 'AUTONOMOUS RUN COMPLETE' : 'PAUSED SAFELY'}</small><strong>{isComplete ? 'Purchased, dispatched, paid and reconciled.' : 'The agents stopped before an unsafe action.'}</strong><p>{isComplete ? `No approval was required after the order arrived. ${snapshot?.selectedSupplier ?? 'The supplier'} was paid only after signed dispatch evidence.` : alert?.message ?? 'Review the failure before resuming from the durable checkpoint.'}</p></div>
          {isBlocked ? <button className="outcome-action" onClick={resume} disabled={starting}><RotateCcw size={13}/>{starting ? 'Retrying…' : 'Resume safely'}</button> : <button className="outcome-action" onClick={() => setNotificationsOpen(true)}><Bell size={13}/>View proof trail</button>}
        </section>}
        <div className="scene-area">
          <div className="scene-caption"><i/> AUTONOMOUS OPERATIONS MAP <span>{followAgents ? 'Following the active agent automatically' : 'Manual inspection mode'}</span><button className={followAgents ? 'active' : ''} onClick={() => setFollowAgents((value) => !value)}>{followAgents ? 'LIVE FOLLOW · ON' : 'FOLLOW AGENTS'}</button></div>
          {snapshot ? <Scene snapshot={snapshot} selected={selected} onSelect={setSelected} reset={reset} zoom={zoom}/> : <div className="empty"><div className="empty-orbit"><span>AO</span></div><h2>Agents standing by</h2><p>Start one order. The team will handle the simulated stock race and finish the purchase autonomously.</p><button className="primary" onClick={start}><Play size={15}/>Start autonomous order</button></div>}
          <div className="scene-legend"><span><i/>Working</span><span><i className="waiting"/>Monitoring</span><span><i className="complete"/>Complete</span></div>
          <div className="scene-controls"><button onClick={() => setZoom((value) => Math.max(.78, value - .1))} aria-label="Zoom out"><Minus size={14}/></button><span/><button onClick={() => { setZoom(1); setReset((value) => value + 1); }} aria-label="Reset view"><RotateCcw size={14}/></button><span/><button onClick={() => setZoom((value) => Math.min(1.35, value + .1))} aria-label="Zoom in"><Plus size={14}/></button></div>
        </div>
      </section>
      <aside className="context">
        <div className="context-eyebrow"><span>AGENT INSPECTOR</span><small>{snapshot?.agents.length ?? 6} desks</small></div>
        <div className="agent-profile"><span className={`agent-portrait ${selectedAgent?.status ?? 'idle'}`}><Command size={21}/><i/></span><div><p>{selected === 'manager' ? 'CONTROL TOWER' : 'SPECIALIST AGENT'}</p><h2>{selectedAgent?.name ?? 'Manager'}</h2></div><span className={`pill ${selectedAgent?.status ?? 'idle'}`}>{readable(selectedAgent?.status ?? 'idle')}</span></div>
        <p className="summary">{selectedAgent?.summary ?? 'Waiting for a paid Shopify order.'}</p>
        {alert && <div className={`notice ${alert.type === 'WorkflowBlocked' ? 'danger' : ''}`}><Bell size={14}/><div><strong>{readable(alert.type)}</strong><span>{alert.message}</span>{snapshot?.status === 'blocked' && <button className="text-btn" onClick={resume} disabled={starting}><RotateCcw size={13}/>{starting ? 'Retrying…' : 'Resume workflow'}</button>}</div></div>}
        <div className="facts"><div><span>Selected supplier</span><strong>{snapshot?.selectedSupplier ?? 'Not selected'}</strong></div><div><span>Escrow state</span><strong>{snapshot?.vault.locked ? `${snapshot.vault.locked} locked` : snapshot?.vault.paid ? `${snapshot.vault.paid} paid` : 'Ready'}</strong></div><div><span>Tracking</span><strong>{snapshot?.trackingNumber ?? 'Not created'}</strong></div><div><span>Chain mode</span><strong>{health?.dependencies.monad ? 'Live testnet' : 'Sandbox'}</strong></div><div><span>Mandate authority</span><strong>{mandate ? `${mandate.remaining} / ${mandate.maxCumulative} remaining${mandate.revoked ? ' · revoked' : ''}` : '40 per order · sandbox'}</strong></div><div><span>Indexer</span><strong>{snapshot?.reconciliation ? `${readable(snapshot.reconciliation.status)} · ${snapshot.reconciliation.attempts} checks` : health?.dependencies.envio ? 'Ready' : 'Not configured'}</strong></div></div>
        <div className="section-title"><h3>Supplier offers</h3><span>{snapshot?.offers.length ?? 0}</span></div>
        <div className="offers">{snapshot?.offers.map((offer) => <div className={`offer ${offer.status}`} key={offer.id}><div><strong>{offer.supplierName}</strong><small>{offer.deliveryDays} business days</small></div><div><b>{offer.total}</b><small>DemoUSD</small></div><span>{readable(offer.status)}</span></div>) ?? <p className="muted">Offers appear when sourcing begins.</p>}</div>
        <div className="section-title"><h3>Live activity</h3><button className="text-btn" onClick={refresh}><RotateCcw size={13}/>Refresh</button></div>
        <div className="feed">{[...(snapshot?.events ?? [])].reverse().map((event) => <article key={event.id}><i/><div><p>{event.message}</p><small>{readable(event.actor)} · {new Date(event.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</small></div></article>)}</div>
      </aside></> : <section className="explain-workspace">{view === 'presentation' ? <Presentation/> : <SystemDesign/>}</section>}
    </section>
  </main>;
}
