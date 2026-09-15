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

## What works now

- Two independently running supplier APIs with authenticated calls and separate SQLite state.
- A persisted, event-driven agent workflow with automatic supplier failover.
- A verified and deduplicated Shopify `orders/paid` webhook endpoint.
- Monad contracts for deposits, bounded mandates, supplier allowlists and dispatch-based escrow.
- Merchant-selected evidence authority; the purchaser cannot choose its verifier per order.
- A separate evidence service rechecks supplier dispatch state before signing a release.
- A live-chain adapter and deployment script; local fallback is visibly labeled `sandbox`.
- Contract tests that deploy the system, reject an unapproved supplier and release an approved
  35 DemoUSD payment against signed dispatch evidence.
- Optional Dynamic wallet login and nonce-bound, expiring merchant intent signature. Direct
  wallet creation of the onchain mandate remains the next Dynamic integration step.
- Optional OpenRouter purchasing planner for initial selection and failure recovery. It can only
  choose from policy-approved offers and is disabled by default to prevent accidental spend.
- A responsive React/Three.js command center driven by persisted backend events over SSE.

No secret is included in the repository. A hash shown in sandbox mode is not presented as an
onchain transaction. Shopify and Monad switch to live-test mode only when every required value
is configured.

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
- **Dynamic:** set `VITE_DYNAMIC_ENVIRONMENT_ID`. The header changes from the sandbox avatar to
  Dynamic's wallet control and allows a nonce-bound, expiring mandate-intent signature. This is
  not yet the onchain `grantRoot` transaction.
- **Monad/Alchemy:** set the RPC and the six role keys, compile, then run
  `corepack pnpm contracts:deploy`. Put the printed non-secret addresses and mandate ID into
  `.env`, restart, and confirm the header says `MONAD TESTNET · LIVE`.
- **OpenRouter/KIMI:** set the API key, an exact supported model ID and
  `ENABLE_MODEL_PLANNER=true`. Without that explicit switch, no paid model call is made.
  Deterministic code owns policy and money movement.
- **Envio:** initialize HyperIndex from the deployed `OrderEscrow` ABI and address under Node 22.
  Envio currently requires Node 22+ and `ENVIO_API_TOKEN` for local HyperSync use. Until its
  GraphQL URL is configured, the interface does not claim the indexer is connected.

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
