# Implementation status

Verified locally on 1 October 2026. This page separates working code from integrations that
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
- Downloadable per-order proof reports generated from persisted workflow state, including agent
  outcomes, the complete event trail, trust boundaries and explorer-linked settlement evidence
  when an order ran on Monad testnet.
- Solidity contracts for DemoUSD, merchant mandates and order escrow, including merchant-selected
  evidence authority and reusable budget restoration after an expired-order refund.
- Independent evidence service that verifies supplier dispatch state before signing release.
- Local-chain coverage for the supplier allowlist, funding, acceptance and signed-evidence
  release path.
- Shopify webhook signature verification and duplicate-event protection.
- Dynamic wallet flow for demo-token funding, escrow deposit and direct onchain mandate creation;
  it becomes available only when Dynamic and Monad deployment values are configured.
- Durable Envio reconciliation jobs with persisted attempts and exponential retry scheduling.
- A complete Envio HyperIndex package for funding, acceptance, release and refund events, with
  generated types and two passing handler tests under Node 22.
- Optional OpenRouter recovery wording, disabled unless explicitly enabled.
- Strict execution-mode boundaries: a sandbox order cannot touch live-chain adapters, and a
  verified Shopify order is rejected before intake unless real settlement and fulfilment are ready.
- The command center reads and displays the active mandate's real per-order cap, cumulative
  allocation, remaining authority and revocation state when Monad is live.

## Implemented, but requires configuration

| Integration | What remains outside the repository |
|---|---|
| Shopify | Development store, webhook secret, Admin token and a reachable callback URL |
| Monad | Fund the generated merchant test wallet, then deploy contracts; the public testnet RPC and five isolated role wallets are already configured locally |
| Dynamic | Project environment ID and an allowed application origin |
| OpenRouter | API key and supported model ID |
| Envio | API token, deployed contract address and hosted GraphQL endpoint; source, config and tests are complete |

Without these values, the product deliberately shows `sandbox` instead of pretending a remote
operation happened. Supplier services, persistence, agent orchestration and the full UI journey
still execute locally.

## Production work, not hackathon claims

- Replace SQLite orchestration with Postgres and a durable job queue.
- Add production identity roles, monitoring and key-management infrastructure; the hackathon
  proof export is an evidence artifact, not a production compliance archive.
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

## Latest verification result

On 1 October 2026, the clean verification pass completed successfully:

- TypeScript typecheck passed.
- All **21 tests across 7 test files** passed, including five local-chain contract scenarios and
  proof-report coverage for both sandbox and live-test evidence.
- The production web build completed.
- The running five-service sandbox completed an autonomous supplier failover with **15 persisted
  events**, ending with Harbor Works selected, paid, dispatched and reconciled.
- The completed order exported a Markdown proof artifact through the API; its sandbox transaction
  reference remained plain text and was explicitly marked as not onchain.
- The static hosted replay build completed with the matching proof artifact bundled for download.
- OpenRouter remained disabled, so the verification consumed no model credits.
- The isolated Envio suite also passed **2 handler tests**, code generation and strict typecheck
  under Node 22.

The local product is complete for demonstration. The remaining work is external activation:
test MON funding for the generated merchant wallet, deployed addresses, Dynamic configuration, a Shopify development
store, Envio deployment and a hosted URL. Those require account values that are not present in
the repository and cannot be truthfully represented as completed.
