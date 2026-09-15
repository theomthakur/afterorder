import { useState } from 'react';
import { DynamicWidget, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import type { Address, Hex, PublicClient, WalletClient } from 'viem';

const tokenAbi = [
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }
] as const;
const escrowAbi = [{ type: 'function', name: 'deposit', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] }] as const;
const registryAbi = [{ type: 'function', name: 'grantRoot', stateMutability: 'nonpayable', inputs: [
  { name: 'id', type: 'bytes32' }, { name: 'delegate', type: 'address' }, { name: 'token', type: 'address' },
  { name: 'evidenceSigner', type: 'address' }, { name: 'perOrder', type: 'uint128' }, { name: 'cumulative', type: 'uint128' },
  { name: 'validAfter', type: 'uint64' }, { name: 'expiresAt', type: 'uint64' }, { name: 'supplierRoot', type: 'bytes32' },
  { name: 'policyCommitment', type: 'bytes32' }
], outputs: [] }] as const;

type MandateConfig = {
  chainId: number; registry: Address; escrow: Address; token: Address; mandateId: Hex; delegate: Address;
  evidenceSigner: Address; perOrder: string; cumulative: string; validAfter: number; expiresAt: number;
  supplierRoot: Hex; policyCommitment: Hex;
};

export function MerchantAccess() {
  const { primaryWallet } = useDynamicContext();
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  if (!primaryWallet) return <DynamicWidget />;

  const createMandate = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/merchant/mandate/config?address=${encodeURIComponent(primaryWallet.address)}`);
      if (!response.ok) throw new Error(response.status === 503 ? 'Monad deployment is not configured yet' : 'Mandate configuration could not be created');
      const config = await response.json() as MandateConfig;
      setProgress('Switching to Monad testnet');
      await primaryWallet.switchNetwork(config.chainId);
      const connector = primaryWallet.connector as unknown as {
        getWalletClient<T>(chainId?: string): T | Promise<T>;
        getPublicClient<T>(): Promise<T>;
      };
      const wallet = await connector.getWalletClient<WalletClient>(String(config.chainId));
      const publicClient = await connector.getPublicClient<PublicClient>();
      const amount = BigInt(config.cumulative);
      const submit = async (label: string, request: Parameters<WalletClient['writeContract']>[0]) => {
        setProgress(label);
        const hash = await wallet.writeContract(request);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') throw new Error(`${label} failed onchain`);
        return hash;
      };
      await submit('Minting test settlement funds', { account: primaryWallet.address as Address, chain: null, address: config.token, abi: tokenAbi, functionName: 'mint', args: [primaryWallet.address as Address, amount] });
      await submit('Approving the escrow', { account: primaryWallet.address as Address, chain: null, address: config.token, abi: tokenAbi, functionName: 'approve', args: [config.escrow, amount] });
      await submit('Depositing the merchant budget', { account: primaryWallet.address as Address, chain: null, address: config.escrow, abi: escrowAbi, functionName: 'deposit', args: [config.token, amount] });
      const txHash = await submit('Creating the bounded mandate', { account: primaryWallet.address as Address, chain: null, address: config.registry, abi: registryAbi, functionName: 'grantRoot', args: [config.mandateId, config.delegate, config.token, config.evidenceSigner, BigInt(config.perOrder), amount, BigInt(config.validAfter), BigInt(config.expiresAt), config.supplierRoot, config.policyCommitment] });
      setProgress('Verifying the mandate');
      const confirmation = await fetch('/api/merchant/mandate/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: primaryWallet.address, mandateId: config.mandateId, txHash }) });
      if (!confirmation.ok) throw new Error('The onchain mandate could not be verified by AfterOrder');
      setAuthorized(true); setProgress('Mandate live');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Mandate creation failed'); }
    finally { setBusy(false); }
  };

  return <div className="merchant-access">
    <DynamicWidget />
    {!authorized && <button onClick={createMandate} disabled={busy}>{busy ? progress || 'Working…' : 'Create onchain mandate'}</button>}
    {authorized && <span>Mandate live · wallet controlled</span>}
    {error && <span title={error}>Setup required</span>}
  </div>;
}
