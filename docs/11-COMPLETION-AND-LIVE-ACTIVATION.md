# AfterOrder completion and live activation

Updated 16 September 2026.

## Current completion line

The sandbox application is complete and repeatable. It runs five services, persists the workflow,
recovers from the configured supplier stock race, verifies dispatch through a separate evidence
service, releases sandbox escrow, reconciles Shopify state and renders the same events in the 3D
command center.

The project must not be called fully live until one public Monad testnet journey exists. No `.env`
file or deployment credentials are present in this repository today.

## Evidence already available

| Layer | Evidence |
|---|---|
| Workflow | 15-event supplier-failover smoke run completes without human intervention |
| Contracts | Five local-chain cases cover allowlists, bounded release, signer separation, refunds and revocation |
| Reliability | Checkpoints, explicit resume and persisted Envio retry queue |
| External boundaries | Signed Shopify webhook, authenticated supplier APIs and independent evidence service |
| Interface | Live journey, six agent stations, notifications, offers, mandate state, presentation and system design |
| Safety | Sandbox and live-test execution are separated per order; no silent fallback |

## External activation gate

Complete these in order after the required account values are available:

1. Create five fresh Monad testnet role wallets: merchant, purchaser, supplier A, supplier B and
   evidence signer. Never reuse personal or mainnet wallets.
2. Fund the merchant wallet and confirm the RPC reports chain ID `10143`.
3. Copy `.env.example` to an ignored `.env`, add the RPC and role keys, then run
   `corepack pnpm contracts:deploy`.
4. Store only the printed non-secret addresses and mandate ID in the deployment record. Never
   commit private keys.
5. Run `corepack pnpm run doctor`; it must report Monad and contracts as live.
6. Configure a Dynamic development project and allow the hosted and local origins. Confirm that
   the connected merchant wallet creates the mandate transaction rather than merely logging in.
7. Create the Shopify development product mapping for `AO-DESK-01`, configure the signed
   `orders/paid` webhook and confirm duplicate delivery creates exactly one order.
8. Deploy the Envio indexer against the actual `OrderEscrow` address. Confirm the payment stays
   complete while indexing is pending and later becomes indexed without rerunning settlement.
9. Run one complete public testnet order and record the mandate, funding, acceptance and release
   transaction links.
10. Deploy the web and API, rerun doctor, tests, build and smoke, then record the two-minute demo.

## Stop conditions

Do not proceed with a live paid-order webhook if any of these is true:

- the connected wallet is not the mandate owner;
- supplier or evidence wallets share a private key with the purchaser;
- the configured chain is not Monad testnet;
- Shopify fulfilment credentials are missing;
- the order would fall back to sandbox settlement;
- the evidence signer cannot independently verify supplier dispatch.

## Submission proof pack

Before 13 October, collect:

- hosted application URL;
- public GitHub repository;
- Monad contract addresses and transaction links;
- Dynamic mandate-creation recording;
- Envio query and UI reconciliation evidence;
- one redacted agent/tool trace showing failure recovery;
- exact explanation of what is sandboxed and what is live;
- two-minute demo video and final social post.
