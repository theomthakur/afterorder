import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createPublicClient, createWalletClient, encodePacked, http, keccak256, parseEther, parseUnits, toBytes, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

type Artifact = { abi: readonly unknown[]; bytecode: Hex };
const read = (name: string) => JSON.parse(fs.readFileSync(path.resolve(`artifacts/contracts/${name}.json`), 'utf8')) as Artifact;
const required = ['MONAD_RPC_URL', 'MERCHANT_PRIVATE_KEY', 'PURCHASER_PRIVATE_KEY', 'SUPPLIER_A_PRIVATE_KEY', 'SUPPLIER_B_PRIVATE_KEY', 'EVIDENCE_SIGNER_PRIVATE_KEY'] as const;
for (const key of required) if (!process.env[key]) throw new Error(`${key} is required`);

const chain = { id: Number(process.env.MONAD_CHAIN_ID ?? 10143), name: 'Monad Testnet', nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: [process.env.MONAD_RPC_URL!] } } } as const;
const merchant = privateKeyToAccount(process.env.MERCHANT_PRIVATE_KEY as Hex);
const purchaser = privateKeyToAccount(process.env.PURCHASER_PRIVATE_KEY as Hex);
const supplierA = privateKeyToAccount(process.env.SUPPLIER_A_PRIVATE_KEY as Hex);
const supplierB = privateKeyToAccount(process.env.SUPPLIER_B_PRIVATE_KEY as Hex);
const evidence = privateKeyToAccount(process.env.EVIDENCE_SIGNER_PRIVATE_KEY as Hex);
const publicClient = createPublicClient({ chain, transport: http() });
const wallet = createWalletClient({ account: merchant, chain, transport: http() });

const deploy = async (name: string, args: readonly unknown[] = []) => {
  const contract = read(name);
  const hash = await wallet.deployContract({ abi: contract.abi, bytecode: contract.bytecode, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error(`${name} deployment returned no address`);
  return receipt.contractAddress;
};
const write = async (address: Address, name: string, functionName: string, args: readonly unknown[]) => {
  const hash = await wallet.writeContract({ address, abi: read(name).abi, functionName, args });
  await publicClient.waitForTransactionReceipt({ hash });
};

const registry = await deploy('MandateRegistry');
const token = await deploy('DemoUSD');
const escrow = await deploy('OrderEscrow', [registry]);
await write(registry, 'MandateRegistry', 'bindEscrow', [escrow]);
await write(token, 'DemoUSD', 'mint', [merchant.address, parseUnits('500', 6)]);
await write(token, 'DemoUSD', 'approve', [escrow, parseUnits('500', 6)]);
await write(escrow, 'OrderEscrow', 'deposit', [token, parseUnits('500', 6)]);
const leafA = keccak256(encodePacked(['address'], [supplierA.address]));
const leafB = keccak256(encodePacked(['address'], [supplierB.address]));
const supplierRoot = leafA < leafB ? keccak256(encodePacked(['bytes32', 'bytes32'], [leafA, leafB])) : keccak256(encodePacked(['bytes32', 'bytes32'], [leafB, leafA]));
const mandateId = keccak256(toBytes(`afterorder:${merchant.address}:${Date.now()}`));
const now = Math.floor(Date.now() / 1000);
await write(registry, 'MandateRegistry', 'grantRoot', [mandateId, purchaser.address, token, parseUnits('40', 6), parseUnits('500', 6), BigInt(now - 60), BigInt(now + 7 * 24 * 3600), supplierRoot, keccak256(toBytes('AfterOrder: approved suppliers; max 40 dUSD per order'))]);
for (const address of [purchaser.address, supplierA.address, supplierB.address, evidence.address]) {
  const hash = await wallet.sendTransaction({ to: address, value: parseEther('0.05') });
  await publicClient.waitForTransactionReceipt({ hash });
}

console.log('\nDeployment complete. Add these non-secret values to .env:\n');
console.log(`ORDER_ESCROW_ADDRESS=${escrow}`);
console.log(`SETTLEMENT_TOKEN_ADDRESS=${token}`);
console.log(`MANDATE_ID=${mandateId}`);
console.log(`SUPPLIER_A_WALLET=${supplierA.address}`);
console.log(`SUPPLIER_B_WALLET=${supplierB.address}`);
console.log(`EVIDENCE_SIGNER_WALLET=${evidence.address}`);
