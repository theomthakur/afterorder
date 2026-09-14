import 'dotenv/config';

const nodeMajor = Number(process.versions.node.split('.')[0]);
const supplierCheck = async (url: string) => {
  try { return (await fetch(`${url}/health`, { signal: AbortSignal.timeout(2_000) })).ok; } catch { return false; }
};
const rpcCheck = async () => {
  if (!process.env.MONAD_RPC_URL) return { configured: false, correctChain: false };
  try {
    const response = await fetch(process.env.MONAD_RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(3_000) });
    const json = await response.json() as { result?: string };
    return { configured: true, correctChain: Number.parseInt(json.result ?? '0', 16) === Number(process.env.MONAD_CHAIN_ID ?? 10143) };
  } catch { return { configured: true, correctChain: false }; }
};

const [supplierA, supplierB, rpc] = await Promise.all([
  supplierCheck(process.env.SUPPLIER_A_URL ?? 'http://127.0.0.1:4201'),
  supplierCheck(process.env.SUPPLIER_B_URL ?? 'http://127.0.0.1:4202'),
  rpcCheck()
]);
const chainValues = ['PURCHASER_PRIVATE_KEY', 'ORDER_ESCROW_ADDRESS', 'MANDATE_ID', 'SETTLEMENT_TOKEN_ADDRESS', 'SUPPLIER_A_WALLET', 'SUPPLIER_B_WALLET', 'SUPPLIER_A_PRIVATE_KEY', 'SUPPLIER_B_PRIVATE_KEY', 'EVIDENCE_SIGNER_PRIVATE_KEY'];
const rows = [
  { component: 'Runtime', status: nodeMajor >= 18 ? 'ready' : 'blocked', detail: `Node ${process.versions.node}` },
  { component: 'Supplier A', status: supplierA ? 'ready' : 'offline', detail: process.env.SUPPLIER_A_URL ?? 'http://127.0.0.1:4201' },
  { component: 'Supplier B', status: supplierB ? 'ready' : 'offline', detail: process.env.SUPPLIER_B_URL ?? 'http://127.0.0.1:4202' },
  { component: 'OpenRouter', status: process.env.OPENROUTER_API_KEY ? 'configured' : 'sandbox', detail: process.env.OPENROUTER_MODEL ?? 'no paid calls' },
  { component: 'Shopify', status: process.env.SHOPIFY_ACCESS_TOKEN && process.env.SHOPIFY_WEBHOOK_SECRET ? 'configured' : 'sandbox', detail: process.env.SHOPIFY_SHOP_DOMAIN ?? 'fixture order' },
  { component: 'Monad RPC', status: !rpc.configured ? 'sandbox' : rpc.correctChain ? 'ready' : 'wrong/unreachable chain', detail: `expected ${process.env.MONAD_CHAIN_ID ?? 10143}` },
  { component: 'Monad contracts', status: chainValues.every((key) => process.env[key]) ? 'configured' : 'sandbox', detail: 'requires every signer/address value' },
  { component: 'Dynamic', status: process.env.VITE_DYNAMIC_ENVIRONMENT_ID ? 'configured' : 'sandbox', detail: 'wallet authorization' },
  { component: 'Envio', status: process.env.ENVIO_GRAPHQL_URL ? 'configured' : 'pending deployment', detail: nodeMajor >= 22 ? 'Node compatible' : 'requires Node 22+' }
];
console.table(rows);
if ((process.env.APP_MODE ?? 'sandbox') === 'live_test' && rows.some((row) => ['wrong/unreachable chain', 'blocked'].includes(row.status))) process.exitCode = 1;
