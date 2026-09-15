import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ganache from 'ganache';
import fs from 'node:fs';
import path from 'node:path';
import { createPublicClient, createWalletClient, custom, defineChain, encodePacked, getAddress, keccak256, parseUnits, toBytes, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

type Artifact = { abi: readonly unknown[]; bytecode: Hex };
const artifact = (name: string) => JSON.parse(fs.readFileSync(path.resolve(`artifacts/contracts/${name}.json`), 'utf8')) as Artifact;

describe('mandate and escrow contracts', () => {
  const provider = ganache.provider({ logging: { quiet: true }, chain: { chainId: 1337 } });
  const transport = custom(provider as never);
  const chain = defineChain({ id: 1337, name: 'AfterOrder Local', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['http://127.0.0.1'] } } });
  const publicClient = createPublicClient({ chain, transport });
  let owner: Address, purchaser: Address, supplier: Address, outsider: Address;
  let approvedPeer: Address;
  let approvedPeerLeaf: Hex;
  let ownerAccount: ReturnType<typeof privateKeyToAccount>;
  let purchaserAccount: ReturnType<typeof privateKeyToAccount>;
  let supplierAccount: ReturnType<typeof privateKeyToAccount>;
  let evidence: ReturnType<typeof privateKeyToAccount>;
  let token: Address, registry: Address, escrow: Address;

  beforeAll(async () => {
    const accounts = provider.getInitialAccounts();
    const entries = Object.entries(accounts);
    ownerAccount = privateKeyToAccount(entries[0]![1].secretKey as Hex);
    purchaserAccount = privateKeyToAccount(entries[1]![1].secretKey as Hex);
    supplierAccount = privateKeyToAccount(entries[2]![1].secretKey as Hex);
    evidence = privateKeyToAccount(entries[4]![1].secretKey as Hex);
    [owner, purchaser, supplier, outsider] = [ownerAccount.address, purchaserAccount.address, supplierAccount.address, getAddress(entries[3]![0])];
    approvedPeer = getAddress(entries[5]![0]);
    const wallet = createWalletClient({ account: ownerAccount, chain, transport });
    const deploy = async (name: string, args: readonly unknown[] = []) => {
      const a = artifact(name);
      const hash = await wallet.deployContract({ abi: a.abi, bytecode: a.bytecode, args });
      return (await publicClient.waitForTransactionReceipt({ hash })).contractAddress!;
    };
    registry = await deploy('MandateRegistry');
    token = await deploy('DemoUSD');
    escrow = await deploy('OrderEscrow', [registry]);
    await publicClient.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: registry, abi: artifact('MandateRegistry').abi, functionName: 'bindEscrow', args: [escrow] }) });
    await publicClient.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: token, abi: artifact('DemoUSD').abi, functionName: 'mint', args: [owner, parseUnits('500', 6)] }) });
    await publicClient.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: token, abi: artifact('DemoUSD').abi, functionName: 'approve', args: [escrow, parseUnits('500', 6)] }) });
    await publicClient.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'deposit', args: [token, parseUnits('500', 6)] }) });
    const mandateId = keccak256(toBytes('afterorder-test-mandate'));
    const supplierLeaf = keccak256(encodePacked(['address'], [supplier]));
    approvedPeerLeaf = keccak256(encodePacked(['address'], [approvedPeer]));
    const supplierRoot = supplierLeaf < approvedPeerLeaf
      ? keccak256(encodePacked(['bytes32', 'bytes32'], [supplierLeaf, approvedPeerLeaf]))
      : keccak256(encodePacked(['bytes32', 'bytes32'], [approvedPeerLeaf, supplierLeaf]));
    const now = Math.floor(Date.now() / 1000);
    await publicClient.waitForTransactionReceipt({ hash: await wallet.writeContract({ address: registry, abi: artifact('MandateRegistry').abi, functionName: 'grantRoot', args: [mandateId, purchaser, token, evidence.address, parseUnits('40', 6), parseUnits('500', 6), BigInt(now - 60), BigInt(now + 3600), supplierRoot, keccak256(toBytes('max 40, approved supplier'))] }) });
  }, 30_000);

  afterAll(async () => { await provider.disconnect(); });

  it('rejects a supplier outside the mandate allowlist', async () => {
    const purchaserWallet = createWalletClient({ account: purchaserAccount, chain, transport });
    const now = Math.floor(Date.now() / 1000);
    await expect(purchaserWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'fundOrder', args: [keccak256(toBytes('bad-order')), keccak256(toBytes('afterorder-test-mandate')), outsider, token, parseUnits('35', 6), BigInt(now + 300), BigInt(now + 600), keccak256(toBytes('bad-intent')), []] })).rejects.toThrow();
  });

  it('locks, accepts, and releases one bounded supplier payment', async () => {
    const purchaserWallet = createWalletClient({ account: purchaserAccount, chain, transport });
    const supplierWallet = createWalletClient({ account: supplierAccount, chain, transport });
    const orderId = keccak256(toBytes('order-1'));
    const mandateId = keccak256(toBytes('afterorder-test-mandate'));
    const intentHash = keccak256(toBytes('order-1:terms'));
    const evidenceDigest = keccak256(toBytes('dispatch-1'));
    const now = Math.floor(Date.now() / 1000);
    const fundHash = await purchaserWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'fundOrder', args: [orderId, mandateId, supplier, token, parseUnits('35', 6), BigInt(now + 300), BigInt(now + 600), intentHash, [approvedPeerLeaf]] });
    await publicClient.waitForTransactionReceipt({ hash: fundHash });
    await publicClient.waitForTransactionReceipt({ hash: await supplierWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'acceptOrder', args: [orderId] }) });
    const messageHash = keccak256(encodePacked(['string', 'uint256', 'address', 'bytes32', 'bytes32', 'bytes32'], ['AFTERORDER_DISPATCH', 1337n, escrow, orderId, intentHash, evidenceDigest]));
    const signature = await evidence.signMessage({ message: { raw: messageHash } });
    await publicClient.waitForTransactionReceipt({ hash: await purchaserWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'releaseOnDispatch', args: [orderId, evidenceDigest, signature] }) });
    const balance = await publicClient.readContract({ address: token, abi: artifact('DemoUSD').abi, functionName: 'balanceOf', args: [supplier] });
    expect(balance).toBe(parseUnits('35', 6));
  }, 30_000);

  it('rejects dispatch evidence from anyone except the verifier selected by the merchant', async () => {
    const purchaserWallet = createWalletClient({ account: purchaserAccount, chain, transport });
    const supplierWallet = createWalletClient({ account: supplierAccount, chain, transport });
    const orderId = keccak256(toBytes('wrong-evidence-order'));
    const mandateId = keccak256(toBytes('afterorder-test-mandate'));
    const intentHash = keccak256(toBytes('wrong-evidence-order:terms'));
    const evidenceDigest = keccak256(toBytes('wrong-evidence-dispatch'));
    const now = Math.floor(Date.now() / 1000);
    await publicClient.waitForTransactionReceipt({ hash: await purchaserWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'fundOrder', args: [orderId, mandateId, supplier, token, parseUnits('20', 6), BigInt(now + 300), BigInt(now + 600), intentHash, [approvedPeerLeaf]] }) });
    await publicClient.waitForTransactionReceipt({ hash: await supplierWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'acceptOrder', args: [orderId] }) });
    const messageHash = keccak256(encodePacked(['string', 'uint256', 'address', 'bytes32', 'bytes32', 'bytes32'], ['AFTERORDER_DISPATCH', 1337n, escrow, orderId, intentHash, evidenceDigest]));
    const supplierSignature = await supplierAccount.signMessage({ message: { raw: messageHash } });
    await expect(purchaserWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'releaseOnDispatch', args: [orderId, evidenceDigest, supplierSignature] })).rejects.toThrow();
    const validSignature = await evidence.signMessage({ message: { raw: messageHash } });
    await publicClient.waitForTransactionReceipt({ hash: await purchaserWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'releaseOnDispatch', args: [orderId, evidenceDigest, validSignature] }) });

    const replayOrderId = keccak256(toBytes('replayed-evidence-order'));
    const replayIntent = keccak256(toBytes('replayed-evidence-order:terms'));
    await publicClient.waitForTransactionReceipt({ hash: await purchaserWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'fundOrder', args: [replayOrderId, mandateId, supplier, token, parseUnits('1', 6), BigInt(now + 300), BigInt(now + 600), replayIntent, [approvedPeerLeaf]] }) });
    await publicClient.waitForTransactionReceipt({ hash: await supplierWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'acceptOrder', args: [replayOrderId] }) });
    const replayMessage = keccak256(encodePacked(['string', 'uint256', 'address', 'bytes32', 'bytes32', 'bytes32'], ['AFTERORDER_DISPATCH', 1337n, escrow, replayOrderId, replayIntent, evidenceDigest]));
    const replaySignature = await evidence.signMessage({ message: { raw: replayMessage } });
    await expect(purchaserWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'releaseOnDispatch', args: [replayOrderId, evidenceDigest, replaySignature] })).rejects.toThrow();
  }, 30_000);

  it('restores reusable mandate capacity once after an expired order is refunded', async () => {
    const ownerWallet = createWalletClient({ account: ownerAccount, chain, transport });
    const purchaserWallet = createWalletClient({ account: purchaserAccount, chain, transport });
    const mandateId = keccak256(toBytes('refundable-mandate'));
    const orderId = keccak256(toBytes('refundable-order'));
    const supplierLeaf = keccak256(encodePacked(['address'], [supplier]));
    const now = Math.floor(Date.now() / 1000);
    await publicClient.waitForTransactionReceipt({ hash: await ownerWallet.writeContract({ address: registry, abi: artifact('MandateRegistry').abi, functionName: 'grantRoot', args: [mandateId, purchaser, token, evidence.address, parseUnits('35', 6), parseUnits('35', 6), BigInt(now - 60), BigInt(now + 3600), supplierLeaf, keccak256(toBytes('refundable budget'))] }) });
    await publicClient.waitForTransactionReceipt({ hash: await purchaserWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'fundOrder', args: [orderId, mandateId, supplier, token, parseUnits('35', 6), BigInt(now + 30), BigInt(now + 60), keccak256(toBytes('refundable-intent')), []] }) });
    expect(await publicClient.readContract({ address: registry, abi: artifact('MandateRegistry').abi, functionName: 'previewSpend', args: [mandateId, token, parseUnits('35', 6)] })).toBe(false);
    await provider.request({ method: 'evm_increaseTime', params: [31] });
    await provider.request({ method: 'evm_mine', params: [] });
    await publicClient.waitForTransactionReceipt({ hash: await ownerWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'refundExpired', args: [orderId] }) });
    expect(await publicClient.readContract({ address: registry, abi: artifact('MandateRegistry').abi, functionName: 'previewSpend', args: [mandateId, token, parseUnits('35', 6)] })).toBe(true);
    await expect(ownerWallet.writeContract({ address: escrow, abi: artifact('OrderEscrow').abi, functionName: 'refundExpired', args: [orderId] })).rejects.toThrow();
  }, 30_000);

  it('enforces the mandate limit and revocation onchain', async () => {
    const ownerWallet = createWalletClient({ account: ownerAccount, chain, transport });
    const mandateId = keccak256(toBytes('revocable-mandate'));
    const supplierLeaf = keccak256(encodePacked(['address'], [supplier]));
    const now = Math.floor(Date.now() / 1000);
    await publicClient.waitForTransactionReceipt({ hash: await ownerWallet.writeContract({ address: registry, abi: artifact('MandateRegistry').abi, functionName: 'grantRoot', args: [mandateId, purchaser, token, evidence.address, parseUnits('40', 6), parseUnits('40', 6), BigInt(now - 60), BigInt(now + 3600), supplierLeaf, keccak256(toBytes('revocable budget'))] }) });
    expect(await publicClient.readContract({ address: registry, abi: artifact('MandateRegistry').abi, functionName: 'previewSpend', args: [mandateId, token, parseUnits('40', 6)] })).toBe(true);
    expect(await publicClient.readContract({ address: registry, abi: artifact('MandateRegistry').abi, functionName: 'previewSpend', args: [mandateId, token, parseUnits('40.000001', 6)] })).toBe(false);
    await publicClient.waitForTransactionReceipt({ hash: await ownerWallet.writeContract({ address: registry, abi: artifact('MandateRegistry').abi, functionName: 'revoke', args: [mandateId] }) });
    expect(await publicClient.readContract({ address: registry, abi: artifact('MandateRegistry').abi, functionName: 'previewSpend', args: [mandateId, token, parseUnits('1', 6)] })).toBe(false);
  }, 30_000);
});
