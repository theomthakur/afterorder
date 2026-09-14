import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Activity, Bell, Box, CircleDollarSign, Play, RotateCcw, ShieldCheck, Store } from 'lucide-react';
import type { AgentId, OrderSnapshot } from '../../../packages/shared/src/types.ts';
import { Scene } from './Scene.tsx';
const MerchantAccess = lazy(() => import('./MerchantAccess.tsx').then((module) => ({ default: module.MerchantAccess })));

const stages = ['received','validating','sourcing','reserving','funding','awaiting_supplier','preparing_shipment','awaiting_dispatch','reconciling','purchase_complete'];
const labels = ['Order','Validate','Offers','Reserve','Escrow','Supplier','Shipment','Dispatch','Reconcile','Complete'];
type Health = { ok: boolean; mode: string; dependencies: { openrouter: boolean; monad: boolean; shopify: boolean; envio: boolean } };

export function App() {
  const [snapshot, setSnapshot] = useState<OrderSnapshot | null>(null);
  const [selected, setSelected] = useState<AgentId>('manager');
  const [starting, setStarting] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const refresh = async () => { const r = await fetch('/api/orders/latest'); if (r.ok) setSnapshot(await r.json()); };
  useEffect(() => { void refresh(); void fetch('/api/health').then((r) => r.json()).then(setHealth); const es = new EventSource('/api/events'); es.addEventListener('order', () => void refresh()); return () => es.close(); }, []);
  const start = async () => { setStarting(true); const r = await fetch('/api/demo/start', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({scenario:'supplier_failover'}) }); if (r.ok) await refresh(); setStarting(false); };
  const activeIndex = snapshot ? Math.max(0, stages.indexOf(snapshot.status)) : -1;
  const selectedAgent = useMemo(() => snapshot?.agents.find((a) => a.id === selected), [snapshot, selected]);
  const alert = [...(snapshot?.events ?? [])].reverse().find((item) => ['StockReservationFailed', 'PlanRevised', 'WorkflowBlocked', 'PurchaseCompleted'].includes(item.type));

  return <main>
    <header><div className="brand"><div className="mark">AO</div><div><strong>AfterOrder</strong><span>Autonomous commerce operations</span></div></div><div className="header-actions"><span className={`network ${health?.dependencies.monad ? 'live' : ''}`}><i/> {health?.dependencies.monad ? 'MONAD TESTNET · LIVE' : 'LOCAL SANDBOX'}</span><button className="icon" aria-label="Notifications"><Bell size={18}/></button>{import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID ? <Suspense fallback={<span className="wallet-loading">Wallet…</span>}><MerchantAccess/></Suspense> : <button className="avatar" aria-label="Sandbox merchant profile">OT</button>}</div></header>
    <section className="layout">
      <aside className="rail"><p className="eyebrow">OPERATIONS</p><button className="nav active"><Activity/>Command center</button><button className="nav"><Box/>Orders</button><button className="nav"><Store/>Suppliers</button><button className="nav"><CircleDollarSign/>Budget</button><button className="nav"><ShieldCheck/>Mandates</button><div className="rail-bottom"><p>Connection modes</p><span><i className={health?.dependencies.shopify ? 'ok':'sandbox'}/> Shopify · {health?.dependencies.shopify ? 'live test' : 'sandbox'}</span><span><i className={health?.dependencies.monad ? 'ok':'sandbox'}/> Monad · {health?.dependencies.monad ? 'live test' : 'sandbox'}</span><span><i className="ok"/> Supplier APIs · live local</span></div></aside>
      <section className="workspace">
        <div className="workspace-top"><div><p className="eyebrow">LIVE COMMAND FLOOR</p><h1>{snapshot ? `${snapshot.displayOrder} · ${snapshot.product}` : 'Ready for the next order'}</h1><p>{snapshot ? `One ${snapshot.sku} · $${snapshot.retailTotal} Shopify test order` : 'Start the canonical supplier failover scenario.'}</p></div><button className="primary" onClick={start} disabled={starting || Boolean(snapshot && snapshot.status !== 'purchase_complete')}><Play size={17}/>{starting ? 'Starting…' : snapshot ? 'Run new order' : 'Start demo order'}</button></div>
        <div className="canvas-wrap">{snapshot ? <Scene snapshot={snapshot} selected={selected} onSelect={setSelected}/> : <div className="empty"><div className="empty-orbit"><span>AO</span></div><h2>Your agents are ready</h2><p>A Shopify order will activate the command floor.</p><button className="primary" onClick={start}><Play size={17}/>Start supplier failover</button></div>}</div>
        <div className="journey">{labels.map((label, i) => <div key={label} className={`journey-step ${i <= activeIndex ? 'done' : ''} ${i === activeIndex ? 'current' : ''}`}><span>{i < activeIndex ? '✓' : i + 1}</span><small>{label}</small></div>)}</div>
      </section>
      <aside className="context">
        <div className="panel-head"><p className="eyebrow">CURRENT FOCUS</p><h2>{selectedAgent?.name ?? 'Manager'}</h2><span className={`pill ${selectedAgent?.status ?? 'idle'}`}>{selectedAgent?.status ?? 'idle'}</span></div>
        <p className="summary">{selectedAgent?.summary ?? 'Waiting for a Shopify order to begin.'}</p>
        {alert && <div className={`notice ${alert.type === 'WorkflowBlocked' ? 'danger' : ''}`}><Bell size={15}/><div><strong>{alert.type.replace(/([A-Z])/g, ' $1').trim()}</strong><span>{alert.message}</span></div></div>}
        <div className="facts"><div><span>Selected supplier</span><strong>{snapshot?.selectedSupplier ?? 'Not selected'}</strong></div><div><span>Escrow</span><strong>{snapshot?.vault.locked ? `${snapshot.vault.locked} DemoUSD locked` : snapshot?.vault.paid ? `${snapshot.vault.paid} DemoUSD paid` : 'Ready'}</strong></div><div><span>Tracking</span><strong>{snapshot?.trackingNumber ?? 'Not created'}</strong></div></div>
        <div className="section-title"><h3>Supplier offers</h3><span>{snapshot?.offers.length ?? 0}</span></div>
        <div className="offers">{snapshot?.offers.map((o) => <div className={`offer ${o.status}`} key={o.id}><div><strong>{o.supplierName}</strong><small>{o.deliveryDays} business days</small></div><div><b>{o.total}</b><small>DemoUSD</small></div><span>{o.status.replace('_',' ')}</span></div>) ?? <p className="muted">Offers appear after sourcing begins.</p>}</div>
        <div className="section-title"><h3>Activity</h3><button className="text-btn" onClick={refresh}><RotateCcw size={14}/>Refresh</button></div>
        <div className="feed">{[...(snapshot?.events ?? [])].reverse().map((e) => <article key={e.id}><i/><div><p>{e.message}</p><small>{e.actor.replace('_',' ')} · {new Date(e.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</small></div></article>)}</div>
      </aside>
    </section>
  </main>;
}
