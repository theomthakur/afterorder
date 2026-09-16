import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createPublicClient, createWalletClient, encodePacked, formatEther, http, keccak256, parseEther, parseUnits, toBytes, type Address, type Hex } from 'viem';
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

const actualChainId = await publicClient.getChainId();
if (actualChainId !== chain.id) throw new Error(`RPC is chain ${actualChainId}; expected Monad testnet ${chain.id}`);
const merchantBalance = await publicClient.getBalance({ address: merchant.address });
console.log(`Merchant deployer: ${merchant.address}`);
console.log(`Test MON balance: ${formatEther(merchantBalance)}`);
if (merchantBalance < parseEther('0.2')) {
  throw new Error(`Fund ${merchant.address} with at least 0.2 test MON at https://faucet.monad.xyz before deployment`);
}
const deploymentStartBlock = await publicClient.getBlockNumber();

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
await write(registry, 'MandateRegistry', 'grantRoot', [mandateId, purchaser.address, token, evidence.address, parseUnits('40', 6), parseUnits('500', 6), BigInt(now - 60), BigInt(now + 45 * 24 * 3600), supplierRoot, keccak256(toBytes('AfterOrder: approved suppliers; max 40 dUSD per order'))]);
for (const address of [purchaser.address, supplierA.address, supplierB.address, evidence.address]) {
  const hash = await wallet.sendTransaction({ to: address, value: parseEther('0.05') });
  await publicClient.waitForTransactionReceipt({ hash });
}

const deployment = {
  chainId: chain.id,
  rpcUrl: process.env.MONAD_RPC_URL,
  deploymentStartBlock: deploymentStartBlock.toString(),
  mandateRegistry: registry,
  orderEscrow: escrow,
  settlementToken: token,
  mandateId,
  merchant: merchant.address,
  purchaser: purchaser.address,
  supplierA: supplierA.address,
  supplierB: supplierB.address,
  evidenceSigner: evidence.address,
  deployedAt: new Date().toISOString(),
};
fs.mkdirSync(path.resolve('data'), { recursive: true });
fs.writeFileSync(path.resolve('data/monad-testnet-deployment.json'), JSON.stringify(deployment, null, 2));

const envPath = path.resolve('.env');
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : fs.readFileSync(path.resolve('.env.example'), 'utf8');
const replacements: Record<string, string> = {
  APP_MODE: 'live_test',
  MANDATE_REGISTRY_ADDRESS: registry,
  ORDER_ESCROW_ADDRESS: escrow,
  SETTLEMENT_TOKEN_ADDRESS: token,
  MANDATE_ID: mandateId,
  SUPPLIER_A_WALLET: supplierA.address,
  SUPPLIER_B_WALLET: supplierB.address,
  EVIDENCE_SIGNER_WALLET: evidence.address,
};
const seen = new Set<string>();
const envLines = envText.split('\n').map((line) => {
  const key = line.match(/^([A-Z0-9_]+)=/)?.[1];
  if (!key || replacements[key] === undefined) return line;
  seen.add(key);
  return `${key}=${replacements[key]}`;
});
for (const [key, value] of Object.entries(replacements)) if (!seen.has(key)) envLines.push(`${key}=${value}`);
fs.writeFileSync(envPath, `${envLines.filter((line, index, lines) => line || index < lines.length - 1).join('\n')}\n`, { mode: 0o600 });
fs.chmodSync(envPath, 0o600);

const indexerTemplate = fs.readFileSync(path.resolve('indexer/config.yaml'), 'utf8');
const indexerConfig = indexerTemplate
  .replace('start_block: 0', `start_block: ${deploymentStartBlock}`)
  .replace('0x0000000000000000000000000000000000000001', escrow);
fs.writeFileSync(path.resolve('indexer/config.local.yaml'), indexerConfig);

console.log('\nDeployment complete. Add these non-secret values to .env:\n');
console.log(`MANDATE_REGISTRY_ADDRESS=${registry}`);
console.log(`ORDER_ESCROW_ADDRESS=${escrow}`);
console.log(`SETTLEMENT_TOKEN_ADDRESS=${token}`);
console.log(`MANDATE_ID=${mandateId}`);
console.log(`SUPPLIER_A_WALLET=${supplierA.address}`);
console.log(`SUPPLIER_B_WALLET=${supplierB.address}`);
console.log(`EVIDENCE_SIGNER_WALLET=${evidence.address}`);
console.log(`ENVIO_CONFIG=config.local.yaml # start block ${deploymentStartBlock}`);
console.log('\n.env, data/monad-testnet-deployment.json and indexer/config.local.yaml were updated locally.');
