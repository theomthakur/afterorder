import crypto from 'node:crypto';
import { createPublicClient, createWalletClient, encodePacked, formatUnits, http, keccak256, parseUnits, toBytes, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getRuntimeSetting } from '../db.ts';

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

const mandateStatusAbi = [{ type: 'function', name: 'mandates', stateMutability: 'view', inputs: [{ name: '', type: 'bytes32' }], outputs: [
  { name: 'parentId', type: 'bytes32' }, { name: 'rootId', type: 'bytes32' }, { name: 'owner', type: 'address' },
  { name: 'delegate', type: 'address' }, { name: 'token', type: 'address' }, { name: 'evidenceSigner', type: 'address' },
  { name: 'maxPerOrder', type: 'uint128' }, { name: 'maxCumulative', type: 'uint128' }, { name: 'allocated', type: 'uint128' },
  { name: 'validAfter', type: 'uint64' }, { name: 'expiresAt', type: 'uint64' }, { name: 'supplierRoot', type: 'bytes32' },
  { name: 'policyCommitment', type: 'bytes32' }, { name: 'revoked', type: 'bool' }, { name: 'depth', type: 'uint8' }
] }] as const;

const required = ['MONAD_RPC_URL', 'PURCHASER_PRIVATE_KEY', 'ORDER_ESCROW_ADDRESS', 'MANDATE_REGISTRY_ADDRESS', 'SETTLEMENT_TOKEN_ADDRESS', 'SUPPLIER_A_WALLET', 'SUPPLIER_B_WALLET', 'SUPPLIER_A_PRIVATE_KEY', 'SUPPLIER_B_PRIVATE_KEY'] as const;
const activeMandateId = () => getRuntimeSetting('active_mandate_id') ?? process.env.MANDATE_ID;
export const chainIsLive = () => required.every((key) => Boolean(process.env[key])) && Boolean(activeMandateId());

export async function getActiveMandateStatus() {
  const mandateId = activeMandateId();
  if (!chainIsLive() || !mandateId) return null;
  const { publicClient } = clients(process.env.PURCHASER_PRIVATE_KEY as Hex);
  const result = await publicClient.readContract({
    address: process.env.MANDATE_REGISTRY_ADDRESS as Hex,
    abi: mandateStatusAbi,
    functionName: 'mandates',
    args: [mandateId as Hex]
  });
  const maxPerOrder = result[6];
  const maxCumulative = result[7];
  const allocated = result[8];
  return {
    mode: 'onchain' as const, mandateId, owner: result[2], delegate: result[3], evidenceSigner: result[5],
    maxPerOrder: formatUnits(maxPerOrder, 6), maxCumulative: formatUnits(maxCumulative, 6),
    allocated: formatUnits(allocated, 6), remaining: formatUnits(maxCumulative - allocated, 6),
    expiresAt: new Date(Number(result[10]) * 1000).toISOString(), revoked: result[13]
  };
}

function clients(privateKey: Hex) {
  const chain = {
    id: Number(process.env.MONAD_CHAIN_ID ?? 10143), name: 'Monad Testnet', nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
    rpcUrls: { default: { http: [process.env.MONAD_RPC_URL!] } }
  } as const;
  const account = privateKeyToAccount(privateKey);
  return { account, publicClient: createPublicClient({ chain, transport: http() }), walletClient: createWalletClient({ account, chain, transport: http() }) };
}

export async function fundEscrow(input: { orderId: string; supplierAddress?: Hex; amount: number; live: boolean }) {
  if (!input.live) {
    return { mode: 'sandbox' as const, orderKey: keccak256(toBytes(input.orderId)), txHash: `0x${crypto.createHash('sha256').update(`fund:${input.orderId}`).digest('hex')}` as Hex };
  }
  if (!chainIsLive() || !input.supplierAddress) throw new Error('Live Monad settlement is not fully configured');
  const purchaser = clients(process.env.PURCHASER_PRIVATE_KEY as Hex);
  const orderKey = keccak256(toBytes(input.orderId));
  const intentHash = keccak256(toBytes(`${input.orderId}:${input.supplierAddress}:${input.amount}`));
  const now = Math.floor(Date.now() / 1000);
  const supplierAddresses = [process.env.SUPPLIER_A_WALLET, process.env.SUPPLIER_B_WALLET].filter(Boolean) as Hex[];
  const otherSupplier = supplierAddresses.find((address) => address.toLowerCase() !== input.supplierAddress!.toLowerCase());
  const supplierProof = otherSupplier ? [keccak256(encodePacked(['address'], [otherSupplier]))] : [];
  const txHash = await purchaser.walletClient.writeContract({
    address: process.env.ORDER_ESCROW_ADDRESS as Hex, abi: escrowAbi, functionName: 'fundOrder',
    args: [orderKey, activeMandateId() as Hex, input.supplierAddress, process.env.SETTLEMENT_TOKEN_ADDRESS as Hex, parseUnits(String(input.amount), 6), BigInt(now + 300), BigInt(now + 1800), intentHash, supplierProof]
  });
  await purchaser.publicClient.waitForTransactionReceipt({ hash: txHash });
  return { mode: 'live' as const, orderKey, txHash, intentHash };
}

export async function previewMandateSpend(amount: number, live: boolean) {
  const fallbackLimit = Number(process.env.DEMO_MAX_PER_ORDER ?? 40);
  if (!live) return { mode: 'sandbox' as const, allowed: amount <= fallbackLimit, maxPerOrder: fallbackLimit };
  const mandateId = activeMandateId();
  const configured = Boolean(process.env.MONAD_RPC_URL && process.env.MANDATE_REGISTRY_ADDRESS && mandateId && process.env.SETTLEMENT_TOKEN_ADDRESS);
  if (!configured) throw new Error('Live mandate policy is not fully configured');
  const chain = {
    id: Number(process.env.MONAD_CHAIN_ID ?? 10143), name: 'Monad Testnet', nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
    rpcUrls: { default: { http: [process.env.MONAD_RPC_URL!] } }
  } as const;
  const publicClient = createPublicClient({ chain, transport: http() });
  const allowed = await publicClient.readContract({
    address: process.env.MANDATE_REGISTRY_ADDRESS as Hex,
    abi: registryAbi,
    functionName: 'previewSpend',
    args: [mandateId as Hex, process.env.SETTLEMENT_TOKEN_ADDRESS as Hex, parseUnits(String(amount), 6)]
  });
  return { mode: 'live' as const, allowed, maxPerOrder: undefined };
}

export async function acceptEscrow(input: { orderKey: Hex; supplierId: string; live: boolean }) {
  const key = input.supplierId === 'supplier_a' ? process.env.SUPPLIER_A_PRIVATE_KEY : process.env.SUPPLIER_B_PRIVATE_KEY;
  if (!input.live) return { mode: 'sandbox' as const, txHash: `0x${crypto.createHash('sha256').update(`accept:${input.orderKey}`).digest('hex')}` as Hex };
  if (!chainIsLive() || !key) throw new Error('Live supplier acceptance is not fully configured');
  const supplier = clients(key as Hex);
  const txHash = await supplier.walletClient.writeContract({ address: process.env.ORDER_ESCROW_ADDRESS as Hex, abi: escrowAbi, functionName: 'acceptOrder', args: [input.orderKey] });
  await supplier.publicClient.waitForTransactionReceipt({ hash: txHash });
  return { mode: 'live' as const, txHash };
}

export async function releaseEscrow(input: { orderKey: Hex; orderId: string; evidenceDigest: Hex; signature: Hex; live: boolean }) {
  if (!input.live) return { mode: 'sandbox' as const, txHash: `0x${crypto.createHash('sha256').update(`release:${input.orderId}`).digest('hex')}` as Hex };
  if (!chainIsLive()) throw new Error('Live payment release is not fully configured');
  const purchaser = clients(process.env.PURCHASER_PRIVATE_KEY as Hex);
  const txHash = await purchaser.walletClient.writeContract({ address: process.env.ORDER_ESCROW_ADDRESS as Hex, abi: escrowAbi, functionName: 'releaseOnDispatch', args: [input.orderKey, input.evidenceDigest, input.signature] });
  await purchaser.publicClient.waitForTransactionReceipt({ hash: txHash });
  return { mode: 'live' as const, txHash };
}
