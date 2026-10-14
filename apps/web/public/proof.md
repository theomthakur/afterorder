# AfterOrder execution proof

Generated: 2026-10-14T01:10:59.414Z

## Run disclosure

- **Execution mode:** Local sandbox
- **Evidence boundary:** This report proves the persisted orchestration and policy path only. It does not claim that tokens moved on a public network.
- **Order:** #AO-A139 (a1392bdb-a980-4395-b75d-7ed2afc5b750)
- **Source order:** sandbox-a1392bdb-a980-4395-b75d-7ed2afc5b750
- **Status:** purchase_complete
- **Created:** 2026-10-14T01:10:54.208Z
- **Updated:** 2026-10-14T01:10:59.379Z

## Purchase result

- **Product:** 1 × Walnut desk organizer (AO-DESK-01)
- **Retail total:** 60
- **Selected supplier:** Harbor Works
- **Tracking:** EZ20000000050
- **Settlement transaction:** 0xbda13be95c9ce6b997b3ffe61e9e133e7cf084e55cb83f22ce93117bb614c03d (sandbox reference; not an onchain transaction)
- **Escrow:** 0 locked · 35 paid · 465 authority remaining
- **Indexer:** pending after 0 check(s)

## Enforced trust boundaries

1. Supplier, price and delivery candidates are filtered before reservation.
2. The purchasing workflow cannot create its own independent dispatch attestation.
3. Escrow release is bound to the order intent and signed evidence.
4. Shopify intake and workflow operations are idempotent.
5. Indexer lag cannot rewrite confirmed payment state.
6. Sandbox and live-test execution never silently fall back into one another.

## Supplier decision record

| Supplier | Quote | Delivery | Outcome | Stock at quote |
|---|---:|---:|---|---|
| Northstar Supply | 32 DemoUSD | 3 days | reservation_failed | yes |
| Harbor Works | 35 DemoUSD | 4 days | accepted | yes |

## Agent completion record

| Agent | State | Final summary |
|---|---|---|
| Logistics | complete | Harbor Works dispatched the order with tracking EZ20000000050 |
| Manager | complete | Purchase completed and external records reconciled |
| Policy | complete | 2 offers satisfy the sandbox spending mandate |
| Purchasing | complete | Supplier order accepted against funded escrow |
| Reconciliation | complete | Supplier paid and Shopify fulfilment verified |
| Sourcing | complete | Harbor Works reserved one AO-DESK-01 |

## Chronological proof trail

| # | Time | Actor | Event | Result | Metadata |
|---:|---|---|---|---|---|
| 1 | 2026-10-14T01:10:54.209Z | shopify | OrderReceived | #AO-A139 entered from Shopify | sku=AO-DESK-01 |
| 2 | 2026-10-14T01:10:54.209Z | manager | OrderValidated | Paid order and AO-DESK-01 mapping verified | — |
| 3 | 2026-10-14T01:10:54.671Z | sourcing | QuoteReceived | 2 supplier offers received through separate APIs | offerCount=2 |
| 4 | 2026-10-14T01:10:55.478Z | sourcing | OfferSelected | Northstar Supply selected at 32 DemoUSD | decisionMode=model; rationale=Northstar Supply offers the lowest total price at 32 DemoUSD. |
| 5 | 2026-10-14T01:10:55.936Z | supplier_a | StockReservationFailed | Northstar Supply could not reserve its last unit | retryable=true; simulated=true; reason=Supplier returned 409 |
| 6 | 2026-10-14T01:10:56.639Z | manager | PlanRevised | Manager switched to Harbor Works within the existing mandate | decisionMode=model; rationale=The prior offer from supplier_a failed, so the alternative offer from supplier_b was selected. |
| 7 | 2026-10-14T01:10:56.660Z | supplier_b | StockReserved | Harbor Works reserved the item | — |
| 8 | 2026-10-14T01:10:57.112Z | chain | EscrowFunded | 35 DemoUSD locked for Harbor Works | txHash=0xbda13be95c9ce6b997b3ffe61e9e133e7cf084e55cb83f22ce93117bb614c03d; mode=sandbox |
| 9 | 2026-10-14T01:10:57.565Z | supplier_b | SupplierAccepted | Harbor Works verified escrow and accepted the order | txHash=0xa981dd6991abcad413bf3b2d9d3ff7c79b211f860dad877bea7e2b6416ada858; mode=sandbox |
| 10 | 2026-10-14T01:10:58.016Z | system | LabelPrepared | Sandbox label prepared with tracking EZ20000000050 | tracking=EZ20000000050; evidenceMode=sandbox |
| 11 | 2026-10-14T01:10:58.023Z | system | DispatchAttested | dispatch-6ad4946b1f3e18051824393b verified by the independent evidence service | evidenceMode=sandbox; occurredAt=2026-10-14T01:10:58.020Z; evidenceDigest=0x55b06359de9bc540bcb4507ef2958ca55cb021dcd82428d3dbe2dc335ae48bc0 |
| 12 | 2026-10-14T01:10:58.476Z | chain | SupplierPaid | 35 DemoUSD released to Harbor Works | txHash=0x4714a3d6f7b50185c3858406a0eebcdee6ebf707153ec5ef9eec3681c50d4d57; mode=sandbox |
| 13 | 2026-10-14T01:10:58.477Z | chain | IndexerPending | Payment is confirmed; independent indexer reconciliation has been queued | txHash=0x4714a3d6f7b50185c3858406a0eebcdee6ebf707153ec5ef9eec3681c50d4d57; reconciliationRequired=true |
| 14 | 2026-10-14T01:10:58.928Z | shopify | ShopifyFulfilmentConfirmed | Shopify fulfilment updated with EZ20000000050 | mode=sandbox; fulfillmentId=sandbox-fulfillment-sandbox-a1392bdb-a980-4395-b75d-7ed2afc5b750 |
| 15 | 2026-10-14T01:10:59.379Z | manager | PurchaseCompleted | Supplier paid · shipment dispatched · Shopify reconciled | — |

## Verification note

This artifact is generated from the same persisted order snapshot used by the AfterOrder command center. It is an audit aid, not a production financial statement. Public-chain claims require a live-test run and independently resolvable explorer links.
