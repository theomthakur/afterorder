import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

const root = path.resolve('.');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');
const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : fs.readFileSync(examplePath, 'utf8');
const values = parse(existing);

const roles = [
  ['MERCHANT_PRIVATE_KEY', 'Merchant deployer'],
  ['PURCHASER_PRIVATE_KEY', 'Purchaser agent'],
  ['SUPPLIER_A_PRIVATE_KEY', 'Northstar supplier'],
  ['SUPPLIER_B_PRIVATE_KEY', 'Harbor supplier'],
  ['EVIDENCE_SIGNER_PRIVATE_KEY', 'Independent evidence signer'],
] as const;

for (const [key] of roles) if (!values[key]) values[key] = generatePrivateKey();
values.MONAD_RPC_URL ||= 'https://testnet-rpc.monad.xyz';
values.MONAD_CHAIN_ID ||= '10143';
values.MONAD_EXPLORER_URL ||= 'https://testnet.monadvision.com';
values.SUPPLIER_A_WALLET = privateKeyToAccount(values.SUPPLIER_A_PRIVATE_KEY as Hex).address;
values.SUPPLIER_B_WALLET = privateKeyToAccount(values.SUPPLIER_B_PRIVATE_KEY as Hex).address;
values.EVIDENCE_SIGNER_WALLET = privateKeyToAccount(values.EVIDENCE_SIGNER_PRIVATE_KEY as Hex).address;

const orderedKeys = [...new Set([
  ...fs.readFileSync(examplePath, 'utf8').split('\n').map((line) => line.match(/^([A-Z0-9_]+)=/)?.[1]).filter(Boolean),
  ...Object.keys(values),
])] as string[];
const serialized = `${orderedKeys.map((key) => `${key}=${values[key] ?? ''}`).join('\n')}\n`;
fs.writeFileSync(envPath, serialized, { mode: 0o600 });
fs.chmodSync(envPath, 0o600);

console.log('Test-only role wallets are stored in ignored .env (private keys were not printed).');
for (const [key, label] of roles) {
  console.log(`${label}: ${privateKeyToAccount(values[key] as Hex).address}`);
}
console.log('\nFund only the Merchant deployer address with test MON before running contracts:deploy.');
