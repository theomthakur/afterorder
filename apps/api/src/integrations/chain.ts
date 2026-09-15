import crypto from 'node:crypto';
import { createPublicClient, createWalletClient, encodePacked, http, keccak256, parseUnits, toBytes, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const escrowAbi = [
  { type: 'function', name: 'fundOrder', stateMutability: 'nonpayable', inputs: [
    { name: 'id', type: 'bytes32' }, { name: 'mandateId', type: 'bytes32' }, { name: 'supplier', type: 'address' },
    { name: 'token', type: 'address' }, { name: 'amount', type: 'uint128' }, { name: 'acceptBy', type: 'uint64' },
    { name: 'dispatchBy', type: 'uint64' }, { name: 'intentHash', type: 'bytes32' },
    { name: 'supplierProof', type: 'bytes32[]' }
  ], outputs: [] },
  { type: 'function', name: 'acceptOrder', stateMutability: 'nonpayable', inputs: [{ name: 'id', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'releaseOnDispatch', stateMutability: 'nonpayable', inputs: [{ name: 'id', type: 'bytes32' }, { name: 'evidenceDigest', type: 'bytes32' }, { name: 'signature', type: 'bytes' }], outputs: [] }
] as const;

const registryAbi = [
  { type: 'function', name: 'previewSpend', stateMutability: 'view', inputs: [
    { name: 'id', type: 'bytes32' }, { name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }
  ], outputs: [{ name: '', type: 'bool' }] }
] as const;

const required = ['MONAD_RPC_URL', 'PURCHASER_PRIVATE_KEY', 'ORDER_ESCROW_ADDRESS', 'MANDATE_REGISTRY_ADDRESS', 'MANDATE_ID', 'SETTLEMENT_TOKEN_ADDRESS', 'SUPPLIER_A_WALLET', 'SUPPLIER_B_WALLET', 'SUPPLIER_A_PRIVATE_KEY', 'SUPPLIER_B_PRIVATE_KEY'] as const;
export const chainIsLive = () => required.every((key) => Boolean(process.env[key]));

function clients(privateKey: Hex) {
  const chain = {
    id: Number(process.env.MONAD_CHAIN_ID ?? 10143), name: 'Monad Testnet', nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
    rpcUrls: { default: { http: [process.env.MONAD_RPC_URL!] } }
  } as const;
  const account = privateKeyToAccount(privateKey);
  return { account, publicClient: createPublicClient({ chain, transport: http() }), walletClient: createWalletClient({ account, chain, transport: http() }) };
}

export async function fundEscrow(input: { orderId: string; supplierAddress?: Hex; amount: number }) {
  if (!chainIsLive() || !input.supplierAddress) {
    return { mode: 'sandbox' as const, orderKey: keccak256(toBytes(input.orderId)), txHash: `0x${crypto.createHash('sha256').update(`fund:${input.orderId}`).digest('hex')}` as Hex };
  }
  const purchaser = clients(process.env.PURCHASER_PRIVATE_KEY as Hex);
  const orderKey = keccak256(toBytes(input.orderId));
  const intentHash = keccak256(toBytes(`${input.orderId}:${input.supplierAddress}:${input.amount}`));
  const now = Math.floor(Date.now() / 1000);
  const supplierAddresses = [process.env.SUPPLIER_A_WALLET, process.env.SUPPLIER_B_WALLET].filter(Boolean) as Hex[];
  const otherSupplier = supplierAddresses.find((address) => address.toLowerCase() !== input.supplierAddress!.toLowerCase());
  const supplierProof = otherSupplier ? [keccak256(encodePacked(['address'], [otherSupplier]))] : [];
  const txHash = await purchaser.walletClient.writeContract({
    address: process.env.ORDER_ESCROW_ADDRESS as Hex, abi: escrowAbi, functionName: 'fundOrder',
    args: [orderKey, process.env.MANDATE_ID as Hex, input.supplierAddress, process.env.SETTLEMENT_TOKEN_ADDRESS as Hex, parseUnits(String(input.amount), 6), BigInt(now + 300), BigInt(now + 1800), intentHash, supplierProof]
  });
  await purchaser.publicClient.waitForTransactionReceipt({ hash: txHash });
  return { mode: 'live' as const, orderKey, txHash, intentHash };
}

export async function previewMandateSpend(amount: number) {
  const fallbackLimit = Number(process.env.DEMO_MAX_PER_ORDER ?? 40);
  const configured = Boolean(process.env.MONAD_RPC_URL && process.env.MANDATE_REGISTRY_ADDRESS && process.env.MANDATE_ID && process.env.SETTLEMENT_TOKEN_ADDRESS);
  if (!configured) return { mode: 'sandbox' as const, allowed: amount <= fallbackLimit, maxPerOrder: fallbackLimit };
  const chain = {
    id: Number(process.env.MONAD_CHAIN_ID ?? 10143), name: 'Monad Testnet', nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
    rpcUrls: { default: { http: [process.env.MONAD_RPC_URL!] } }
  } as const;
  const publicClient = createPublicClient({ chain, transport: http() });
  const allowed = await publicClient.readContract({
    address: process.env.MANDATE_REGISTRY_ADDRESS as Hex,
    abi: registryAbi,
    functionName: 'previewSpend',
    args: [process.env.MANDATE_ID as Hex, process.env.SETTLEMENT_TOKEN_ADDRESS as Hex, parseUnits(String(amount), 6)]
  });
  return { mode: 'live' as const, allowed, maxPerOrder: undefined };
}

export async function acceptEscrow(input: { orderKey: Hex; supplierId: string }) {
  const key = input.supplierId === 'supplier_a' ? process.env.SUPPLIER_A_PRIVATE_KEY : process.env.SUPPLIER_B_PRIVATE_KEY;
  if (!chainIsLive() || !key) return { mode: 'sandbox' as const, txHash: `0x${crypto.createHash('sha256').update(`accept:${input.orderKey}`).digest('hex')}` as Hex };
  const supplier = clients(key as Hex);
  const txHash = await supplier.walletClient.writeContract({ address: process.env.ORDER_ESCROW_ADDRESS as Hex, abi: escrowAbi, functionName: 'acceptOrder', args: [input.orderKey] });
  await supplier.publicClient.waitForTransactionReceipt({ hash: txHash });
  return { mode: 'live' as const, txHash };
}

export async function releaseEscrow(input: { orderKey: Hex; orderId: string; evidenceDigest: Hex; signature: Hex }) {
  if (!chainIsLive()) return { mode: 'sandbox' as const, txHash: `0x${crypto.createHash('sha256').update(`release:${input.orderId}`).digest('hex')}` as Hex };
  const purchaser = clients(process.env.PURCHASER_PRIVATE_KEY as Hex);
  const txHash = await purchaser.walletClient.writeContract({ address: process.env.ORDER_ESCROW_ADDRESS as Hex, abi: escrowAbi, functionName: 'releaseOnDispatch', args: [input.orderKey, input.evidenceDigest, input.signature] });
  await purchaser.publicClient.waitForTransactionReceipt({ hash: txHash });
  return { mode: 'live' as const, txHash };
}
