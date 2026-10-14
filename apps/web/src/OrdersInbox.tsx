import { AlertTriangle, CheckCircle2, Loader2, Play } from 'lucide-react';
import { PartnerLogo } from './Partners.tsx';

export type OrderSummary = { id: string; displayOrder: string; product: string; status: string; mode: string; selectedSupplier: string | null; retailTotal: number; escrowAmount: number; createdAt: string; updatedAt: string; lastEvent: string | null };

const readable = (value: string) => value.replaceAll('_', ' ');
const COLUMNS = [
  { key: 'attention', title: 'Needs attention', note: 'Paused before an unsafe step', icon: AlertTriangle, empty: 'Nothing needs you right now.', match: (o: OrderSummary) => ['blocked', 'failed'].includes(o.status) },
  { key: 'progress', title: 'In progress', note: 'Agents are working', icon: Loader2, empty: 'No orders running.', match: (o: OrderSummary) => !['blocked', 'failed', 'purchase_complete'].includes(o.status) },
  { key: 'done', title: 'Completed', note: 'Paid, shipped, reconciled', icon: CheckCircle2, empty: 'No completed orders yet.', match: (o: OrderSummary) => o.status === 'purchase_complete' },
] as const;

export function OrdersInbox({ orders, onOpen, onRun, running }: { orders: OrderSummary[]; onOpen: (id: string) => void; onRun: () => void; running: boolean }) {
  return <div className="board-page">
    <header className="board-head">
      <div><p>OPERATIONS</p><h1>Orders</h1><span>Paid <PartnerLogo name="Shopify" size={13}/> Shopify orders arrive automatically. Open any order to watch its agents.</span></div>
      <button className="primary board-run" onClick={onRun} disabled={running}><Play size={14}/>{running ? 'Starting…' : 'Run sandbox order'}</button>
    </header>
    <div className="board-columns">
      {COLUMNS.map((column) => {
        const list = orders.filter(column.match);
        return <section key={column.key} className={`board-column ${column.key}`}>
          <div className="board-column-head"><column.icon size={15}/><div><h2>{column.title}</h2><small>{column.note}</small></div><b>{list.length}</b></div>
          <div className="board-cards">
            {list.length ? list.slice(0, 6).map((order) => <button key={order.id} className="board-card" onClick={() => onOpen(order.id)}>
              <div className="board-card-top"><b>{order.displayOrder}</b><span className={`board-mode ${order.mode}`}>{order.mode === 'live_test' ? 'Live' : 'Sandbox'}</span></div>
              <p>{order.product}</p>
              <small>{order.lastEvent ?? readable(order.status)}</small>
              <div className="board-card-foot"><span>{order.selectedSupplier ?? 'Sourcing…'}</span><span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
            </button>) : <p className="board-empty">{column.empty}</p>}
            {list.length > 6 && <p className="board-more">+ {list.length - 6} more {column.title.toLowerCase()}</p>}
          </div>
        </section>;
      })}
    </div>
  </div>;
}
