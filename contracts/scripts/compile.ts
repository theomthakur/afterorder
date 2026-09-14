import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
const root = path.resolve('contracts/src');
const sources = Object.fromEntries(fs.readdirSync(root).filter((f) => f.endsWith('.sol')).map((file) => [file, { content: fs.readFileSync(path.join(root, file), 'utf8') }]));
const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, outputSelection: { '*': { '*': ['abi','evm.bytecode.object'] } } } })));
const errors = (output.errors ?? []).filter((e: any) => e.severity === 'error');
if (errors.length) { console.error(errors.map((e: any) => e.formattedMessage).join('\n')); process.exit(1); }
const out = path.resolve('artifacts/contracts'); fs.mkdirSync(out, { recursive: true });
for (const [file, contracts] of Object.entries(output.contracts) as any) for (const [name, artifact] of Object.entries(contracts) as any) fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ contractName: name, sourceName: file, abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` }, null, 2));
console.log(`Compiled ${Object.keys(output.contracts).length} Solidity source files.`);
