export type WorkflowStatus =
  | 'received'
  | 'validating'
  | 'sourcing'
  | 'reserving'
  | 'funding'
  | 'awaiting_supplier'
  | 'preparing_shipment'
  | 'awaiting_dispatch'
  | 'reconciling'
  | 'purchase_complete'
  | 'blocked';

export type AgentId = 'manager' | 'sourcing' | 'policy' | 'logistics' | 'purchasing' | 'reconciliation';
export type AgentStatus = 'idle' | 'working' | 'waiting' | 'retrying' | 'blocked' | 'complete';

export interface AgentState {
  id: AgentId;
  name: string;
  status: AgentStatus;
  summary: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  supplierId: string;
  supplierName: string;
  total: number;
  currency: 'DemoUSD';
  deliveryDays: number;
  inStock: boolean;
  status: 'quoted' | 'rejected' | 'reservation_failed' | 'selected' | 'accepted';
  quoteId?: string;
  expiresAt?: string;
  supplierAddress?: `0x${string}`;
}

export interface OrderEvent {
  id: number;
  orderId: string;
  type: string;
  message: string;
  actor: AgentId | 'shopify' | 'supplier_a' | 'supplier_b' | 'chain' | 'system';
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface OrderSnapshot {
  id: string;
  shopifyOrderId: string;
  displayOrder: string;
  sku: string;
  product: string;
  quantity: number;
  retailTotal: number;
  status: WorkflowStatus;
  mode: 'sandbox' | 'live_test';
  selectedSupplier?: string;
  trackingNumber?: string;
  chainTxHash?: string;
  createdAt: string;
  updatedAt: string;
  offers: Offer[];
  agents: AgentState[];
  events: OrderEvent[];
  reconciliation?: { status: 'pending' | 'indexed' | 'mismatch'; attempts: number; lastError?: string };
  vault: { deposited: number; available: number; locked: number; paid: number; allowanceRemaining: number };
}

const agentNames: Array<readonly [AgentId, string]> = [
  ['manager', 'Manager'],
  ['sourcing', 'Sourcing'],
  ['policy', 'Policy'],
  ['logistics', 'Logistics'],
  ['purchasing', 'Purchasing'],
  ['reconciliation', 'Reconciliation']
];

export const agentDefaults: AgentState[] = agentNames.map(([id, name]) => ({
  id,
  name,
  status: 'idle',
  summary: 'Waiting for an order',
  updatedAt: new Date(0).toISOString()
}));
