import crypto from 'node:crypto';
import { keccak256, toBytes, type Hex } from 'viem';

export async function attestDispatch(input: { orderId: string; orderKey: Hex; intentHash?: Hex; evidenceId: string; supplierId: string; occurredAt: string }) {
  const evidenceDigest = keccak256(toBytes(input.evidenceId));
  if (!input.intentHash || !process.env.ORDER_ESCROW_ADDRESS || !process.env.MONAD_RPC_URL) {
    return { mode: 'sandbox' as const, evidenceDigest, signature: `0x${crypto.createHash('sha256').update(`attestation:${input.evidenceId}`).digest('hex')}` as Hex };
  }
  const base = process.env.EVIDENCE_SERVICE_URL ?? 'http://127.0.0.1:4300';
  const response = await fetch(`${base}/attestations/dispatch`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.EVIDENCE_SERVICE_TOKEN ?? 'afterorder-evidence-local-only'}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(6_000),
    body: JSON.stringify({
      chainId: Number(process.env.MONAD_CHAIN_ID ?? 10143),
      escrowAddress: process.env.ORDER_ESCROW_ADDRESS,
      orderId: input.orderId,
      orderKey: input.orderKey,
      intentHash: input.intentHash,
      evidenceDigest,
      evidenceId: input.evidenceId,
      supplierId: input.supplierId,
      occurredAt: input.occurredAt
    })
  });
  if (!response.ok) throw new Error(`Independent evidence service rejected dispatch (${response.status})`);
  const result = await response.json() as { signature?: Hex; evidenceDigest?: Hex };
  if (!result.signature || result.evidenceDigest?.toLowerCase() !== evidenceDigest.toLowerCase()) throw new Error('Independent evidence response is incomplete or mismatched');
  return { mode: 'live' as const, evidenceDigest, signature: result.signature };
}
