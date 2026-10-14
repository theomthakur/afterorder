<p align="center">
  <img src="apps/web/public/afterorder-logo.svg" alt="AfterOrder logo" width="72" />
</p>

# AfterOrder

**From order to fulfilment, with agents accountable for every purchase.**

AfterOrder turns a paid Shopify order into a bounded supplier purchase. A manager agent asks
specialists to source offers, apply merchant rules, reserve inventory, fund supplier escrow,
coordinate dispatch and reconcile Shopify. The whole journey appears in a live 3D command
center, including failures and replanning.

The canonical demo is deliberately small and real: Northstar quotes the lowest price but its
reservation fails because the last unit is gone. The manager automatically switches to Harbor
Works without changing the merchant's 40 DemoUSD limit.

## Live status (13 Oct 2026, Monad Metropolis submission)

| Integration | Status | Evidence |
|---|---|---|
| **Monad testnet** | Live | MandateRegistry [`0x60df…0898`](https://testnet.monadvision.com/address/0x60dfb74d92872300878ceb07e354ec0d39550898), OrderEscrow [`0xf7b5…ef2b`](https://testnet.monadvision.com/address/0xf7b5e46bcb15282325f5b45d9cc819b08f66ef2b), DemoUSD [`0x6fe6…c67e`](https://testnet.monadvision.com/address/0x6fe6b2348c75a006fc30dd772a7ca471eaa1c67e) |
| **Shopify** | Live | Dev store order #1001: signed `orders/paid` webhook started the agents; fulfilment `gid://shopify/Fulfillment/7761692754082` with tracking |
| **Dynamic + MetaMask** | Live | Merchant wallet `0xdc93…1651` signed the mandate ([grantRoot](https://testnet.monadvision.com/tx/0x72dd49458d89af9d233f019ae5d679436fdefc20cce424a3aae600e546743bfb)) |
| **OpenRouter → Gemini 2.5 Flash Lite** | Live | Manager decisions logged with `decisionMode: model` |
| **Envio HyperIndex** | Deployed | Indexer for escrow events runs on Envio hosting; its development-tier endpoint was unavailable on 13 Oct, so the app shows reconciliation as pending |

Order #1001 on Monad: [escrow funded](https://testnet.monadvision.com/tx/0x9b5ef305d5bd804642a8df00a3fe60134d9d4710d1beaa171aa14a34f4d7a1e6) · [supplier accepted](https://testnet.monadvision.com/tx/0xe7ac00ff086fbeaca8e22a0146660ad5e097fddafe57e961060c6944cf578240) · [released on signed dispatch evidence](https://testnet.monadvision.com/tx/0x7165bcd50688ce3f5cd815b4c4316bb96f175a4a23c86698c6b6dd1cd9f54ac2)

The app opens on an intro page. **Try it out** goes to the command center, where you can instruct the manager agent in chat (sandbox order) or let a paid Shopify order start a live run. Full submission notes: [`docs/12-SUBMISSION-2026-10-13.md`](docs/12-SUBMISSION-2026-10-13.md).

### Run live locally

1. Copy `.env.example` to `.env` and fill in the Monad, OpenRouter, Dynamic, Shopify and Envio values.
2. Fund the merchant wallet from the Monad faucet, then run `corepack pnpm contracts:deploy`.
3. Run `corepack pnpm dev`, then open http://localhost:5173.
4. Expose the API for Shopify: `npx cloudflared tunnel --url http://127.0.0.1:4100`. Then add an **Order payment** webhook to `<tunnel>/webhooks/shopify/orders-paid`, and set `SHOPIFY_WEBHOOK_SECRET` to the signing key Shopify shows.
5. Optional: `npx tsx scripts/live-chain-proof.ts` runs one live order on Monad without Shopify.

## What works now

- Two independently running supplier APIs with authenticated calls and separate SQLite state.
- A restart-safe, persisted agent workflow with automatic supplier failover.
- Recoverable failures pause at their saved checkpoint and can be resumed from the command center
  without creating a duplicate workflow.
- A verified and deduplicated Shopify `orders/paid` webhook endpoint.
- Monad contracts for deposits, bounded mandates, supplier allowlists and dispatch-based escrow.
- Merchant-selected evidence authority; the purchaser cannot choose its verifier per order.
- A separate evidence service rechecks supplier dispatch state before signing a release.
- A live-chain adapter and deployment script; local fallback is visibly labeled `sandbox`.
- Contract tests that deploy the system, reject an unapproved supplier and release an approved
  35 DemoUSD payment against signed dispatch evidence.
- Dynamic wallet onboarding that funds the test escrow and creates the bounded onchain mandate
  directly from the connected merchant wallet when Monad is configured.
- A durable Envio reconciliation queue that survives API restarts.
- Live mandate limits and remaining authority displayed from the contract rather than a UI constant.
- Optional OpenRouter purchasing planner for initial selection and failure recovery. It can only
  choose from policy-approved offers and is disabled by default to prevent accidental spend.
- A responsive React/Three.js command center driven by persisted backend events over SSE.
- A downloadable order-proof report that turns the persisted agent and payment trail into a
  judge-readable Markdown artifact, with explicit sandbox/live labels and explorer links for live
  Monad transactions.

No secret is included in the repository. A hash shown in sandbox mode is not presented as an
onchain transaction. Execution mode belongs to each order: adding credentials cannot make a
sandbox demo spend testnet assets, and a real Shopify order is rejected before intake unless
Monad settlement and Shopify fulfilment are both configured. There is no silent live-to-sandbox
fallback.

## Hosted replay

https://afterorder-six.vercel.app plays back one recorded sandbox run of the supplier-failover
journey, so the command center can be viewed without starting five services. It is labeled
`RECORDED SANDBOX REPLAY`; nothing on that page calls an API or a chain. Its **Export proof** action
downloads the matching recorded evidence artifact. To refresh both artifacts, start the backend
services, then run `corepack pnpm replay:record` and `corepack pnpm build:replay`.

## Run the complete local demo

Requirements: Node 18 or newer and Corepack.

```bash
corepack prepare pnpm@9.15.9 --activate
corepack pnpm install
cp .env.example .env
corepack pnpm dev
```

Open `http://localhost:5173` and click **Start supplier failover**. The command starts five
processes: Northstar on port 4201, Harbor Works on 4202, the evidence verifier on 4300, the API
on 4100 and the web app on 5173.

The left navigation also includes a seven-slide presentation (`#presentation`) and an interactive
system-design explanation (`#system-design`). The repository version of the architecture is in
[`docs/SYSTEM-DESIGN.md`](docs/SYSTEM-DESIGN.md).

The same full flow can be checked from the terminal while those processes are running:

```bash
corepack pnpm smoke
```

After a run completes, use **Export proof** in the outcome panel or request
`/api/orders/<order-id>/proof.md`. The report records the selected supplier, agent states,
decision trail, trust boundaries and settlement evidence without presenting sandbox hashes as
onchain transactions.

## Verify before a demo

```bash
corepack pnpm run doctor
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

`pnpm test` compiles all contracts and runs both unit and local-chain integration tests.

## Live integrations

Copy `.env.example` to `.env` and fill only the services you are ready to exercise.

- **Shopify:** set the shop domain, Admin API token and webhook secret. Point the paid-order
  webhook at `/webhooks/shopify/orders-paid`. Only the mapped `AO-DESK-01` single-item fixture
  is accepted.
- **Dynamic:** set `VITE_DYNAMIC_ENVIRONMENT_ID` and the Monad deployment values. The connected
  merchant wallet mints demo funds, deposits them into escrow, creates `grantRoot`, and the API
  verifies the confirmed registry transaction before using the mandate.
- **Monad:** run `corepack pnpm wallets:bootstrap`, fund only the printed merchant address with
  test MON, compile, then run `corepack pnpm contracts:deploy`. The deployer verifies chain ID and
  balance, deploys the contracts, updates ignored local configuration and prepares Envio's local
  config. Confirm the header says `MONAD TESTNET · LIVE`.
- **OpenRouter/KIMI:** set the API key, an exact supported model ID and
  `ENABLE_MODEL_PLANNER=true`. Without that explicit switch, no paid model call is made.
  Deterministic code owns policy and money movement.
- **Envio:** the complete HyperIndex package is in `indexer/` and has its own tests. It requires
  Node 22+, an Envio API token and a deployed `OrderEscrow`. The contract deployer generates
  `indexer/config.local.yaml`; run the indexer with that config and put its GraphQL URL in the root
  `.env`. Until then, the interface does not claim the indexer is connected.

## Architecture

```text
Shopify paid order ──> verified intake ──> persisted workflow
                                              │
                     manager + specialist agents
                         │              │
                supplier A/B APIs   validated action gateway
                         │              │
                       dispatch     Monad escrow + Shopify
                              \        /
                               reconciliation
                                     │
                         SSE ──> 3D command center
```

Operational state currently uses SQLite so one command runs the complete prototype. The master
plan describes the Postgres/pg-boss production migration; SQLite is not represented as a
production queue.

## Repository map

```text
apps/api/                 workflow API and live/sandbox adapters
apps/evidence/            independent dispatch verification and signing service
apps/supplier/            independently configured supplier service
apps/web/                 React UI and 3D command center
contracts/src/            DemoUSD, MandateRegistry and OrderEscrow
contracts/scripts/        compiler and Monad deployment
packages/shared/          shared types and input schemas
scripts/                  doctor and end-to-end smoke checks
tests/                    schema and local-chain contract tests
docs/                     event, track and resource decisions
AFTERORDER-MASTER-IMPLEMENTATION-PLAN.md
```

## Honest boundary

The local prototype is complete and testable. Live Shopify, Dynamic, Monad, Envio and hosted
deployment still require their respective development accounts, tokens and testnet funding.
Those missing external values are setup work, not code paths disguised as completed features.
The demo uses synthetic commerce data and DemoUSD has no monetary value.
