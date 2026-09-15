# Implementation status

Verified locally on 15 September 2026. This page separates working code from integrations that
still require external accounts or deployment.

The verified next implementation pass is recorded in
[`10-REVIEW-FIXES.md`](./10-REVIEW-FIXES.md). Those items are deferred work, not current features.

## Working now

- Paid-order intake, restart-safe SQLite job checkpoints and a complete supplier-failover journey.
- Recoverable failures pause at their saved checkpoint and can be resumed explicitly without
  creating a second workflow job.
- Separate Northstar and Harbor supplier services with authenticated requests and separate
  inventories.
- Manager, sourcing, policy, reservation, settlement, fulfilment and reconciliation stages.
- Automatic replanning when the preferred supplier cannot reserve stock.
- 3D operations room, visible journey, alerts, offers and live backend events.
- In-product seven-slide presentation and system-design walkthrough, linked from the main rail.
- Solidity contracts for DemoUSD, merchant mandates and order escrow, including merchant-selected
  evidence authority and reusable budget restoration after an expired-order refund.
- Independent evidence service that verifies supplier dispatch state before signing release.
- Local-chain coverage for the supplier allowlist, funding, acceptance and signed-evidence
  release path.
- Shopify webhook signature verification and duplicate-event protection.
- Dynamic wallet flow for demo-token funding, escrow deposit and direct onchain mandate creation;
  it becomes available only when Dynamic and Monad deployment values are configured.
- Durable Envio reconciliation jobs with persisted attempts and exponential retry scheduling.
- Optional OpenRouter recovery wording, disabled unless explicitly enabled.
- Strict execution-mode boundaries: a sandbox order cannot touch live-chain adapters, and a
  verified Shopify order is rejected before intake unless real settlement and fulfilment are ready.
- The command center reads and displays the active mandate's real per-order cap, cumulative
  allocation, remaining authority and revocation state when Monad is live.

## Implemented, but requires configuration

| Integration | What remains outside the repository |
|---|---|
| Shopify | Development store, webhook secret, Admin token and a reachable callback URL |
| Monad | Testnet RPC, funded role wallets, deployed contract addresses and mandate ID |
| Dynamic | Project environment ID and an allowed application origin |
| OpenRouter | API key and supported model ID |
| Envio | Node 22 environment, API token, deployed contract address and hosted GraphQL endpoint |

Without these values, the product deliberately shows `sandbox` instead of pretending a remote
operation happened. Supplier services, persistence, agent orchestration and the full UI journey
still execute locally.

## Production work, not hackathon claims

- Replace SQLite orchestration with Postgres and a durable job queue.
- Add production identity roles, audit export, monitoring and key-management infrastructure.
- Complete real merchant and supplier onboarding, legal review and operational support paths.
- Run load, recovery and adversarial security testing in the deployed environment.
- Validate the purchasing problem and workflow with merchants before claiming measured impact.

## Verification commands

```bash
corepack pnpm run doctor
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm dev
corepack pnpm smoke
```
