import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, Play } from 'lucide-react';
import { PartnerLogo } from './Partners.tsx';

export type OrderSummary = { id: string; displayOrder: string; product: string; status: string; mode: string; selectedSupplier: string | null; retailTotal: number; escrowAmount: number; createdAt: string; updatedAt: string; lastEvent: string | null };

const readable = (value: string) => value.replaceAll('_', ' ');
const GROUPS = [
  { key: 'attention', title: 'Needs attention', note: 'Agents paused before an unsafe step. Review and resume.', icon: AlertTriangle, match: (o: OrderSummary) => ['blocked', 'failed'].includes(o.status) },
  { key: 'progress', title: 'In progress', note: 'Agents are working. No action needed.', icon: Loader2, match: (o: OrderSummary) => !['blocked', 'failed', 'purchase_complete'].includes(o.status) },
  { key: 'done', title: 'Completed', note: 'Paid, shipped and reconciled. Proof report ready.', icon: CheckCircle2, match: (o: OrderSummary) => o.status === 'purchase_complete' },
] as const;

export function OrdersInbox({ orders, onOpen, onRun, running }: { orders: OrderSummary[]; onOpen: (id: string) => void; onRun: () => void; running: boolean }) {
  return <div className="inbox-page">
    <header className="inbox-head">
      <div><p>OPERATIONS</p><h1>Orders</h1><span>Paid <PartnerLogo name="Shopify" size={13}/> Shopify orders arrive here automatically. You only step in when something needs attention.</span></div>
      <button className="primary inbox-run" onClick={onRun} disabled={running}><Play size={14}/>{running ? 'Starting…' : 'Run sandbox order'}</button>
    </header>
    <div className="inbox-counts">{GROUPS.map((group) => <div key={group.key} className={`inbox-count ${group.key}`}><group.icon size={16}/><b>{orders.filter(group.match).length}</b><span>{group.title}</span></div>)}</div>
    {GROUPS.map((group) => {
      const list = orders.filter(group.match);
      return <section key={group.key} className={`inbox-group ${group.key}`}>
        <div className="inbox-group-title"><h2>{group.title}</h2><small>{group.note}</small></div>
        {list.length ? <div className="inbox-list">{list.map((order) => <button key={order.id} className="inbox-row" onClick={() => onOpen(order.id)}>
          <span className={`inbox-dot ${group.key}`}/>
          <div className="inbox-main"><b>{order.displayOrder} · {order.product}</b><small>{order.lastEvent ?? readable(order.status)}</small></div>
          <div className="inbox-meta"><span className={`inbox-mode ${order.mode}`}>{order.mode === 'live_test' ? 'Live · Monad testnet' : 'Sandbox'}</span><small>{order.selectedSupplier ?? 'Sourcing…'} · ${order.retailTotal}</small></div>
          <small className="inbox-time">{new Date(order.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
          <ChevronRight size={16}/>
        </button>)}</div> : <p className="inbox-empty">Nothing here.</p>}
      </section>;
    })}
  </div>;
}
