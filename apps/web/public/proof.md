# AfterOrder execution proof

Generated: 2026-10-01T20:10:36.893Z

## Run disclosure

- **Execution mode:** Local sandbox
- **Evidence boundary:** This report proves the persisted orchestration and policy path only. It does not claim that tokens moved on a public network.
- **Order:** #AO-467B (467bb6ff-2cfb-49b5-8091-705aceb4010d)
- **Source order:** sandbox-467bb6ff-2cfb-49b5-8091-705aceb4010d
- **Status:** purchase_complete
- **Created:** 2026-10-01T20:10:33.195Z
- **Updated:** 2026-10-01T20:10:36.864Z

## Purchase result

- **Product:** 1 × Walnut desk organizer (AO-DESK-01)
- **Retail total:** 60
- **Selected supplier:** Harbor Works
- **Tracking:** EZ2000000000d
- **Settlement transaction:** 0x0b8eebf37e2f67fb76ec6651fb23d02d5c44a8507508da5bc158ccf67004adf6 (sandbox reference; not an onchain transaction)
- **Escrow:** 0 locked · 35 paid · 465 authority remaining
- **Indexer:** indexed after 1 check(s) · Envio is not configured in sandbox

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
| Logistics | complete | Harbor Works dispatched the order with tracking EZ2000000000d |
| Manager | complete | Purchase completed and external records reconciled |
| Policy | complete | 2 offers satisfy the sandbox spending mandate |
| Purchasing | complete | Supplier order accepted against funded escrow |
| Reconciliation | complete | Supplier paid and Shopify fulfilment verified |
| Sourcing | complete | Harbor Works reserved one AO-DESK-01 |

## Chronological proof trail

| # | Time | Actor | Event | Result | Metadata |
|---:|---|---|---|---|---|
| 1 | 2026-10-01T20:10:33.197Z | shopify | OrderReceived | #AO-467B entered from Shopify | sku=AO-DESK-01 |
| 2 | 2026-10-01T20:10:33.199Z | manager | OrderValidated | Paid order and AO-DESK-01 mapping verified | — |
| 3 | 2026-10-01T20:10:33.661Z | sourcing | QuoteReceived | 2 supplier offers received through separate APIs | offerCount=2 |
| 4 | 2026-10-01T20:10:33.663Z | sourcing | OfferSelected | Northstar Supply selected at 32 DemoUSD | decisionMode=deterministic; rationale=Selecting Northstar Supply: the lowest-cost policy-approved offer at 32 DemoUSD. |
| 5 | 2026-10-01T20:10:34.121Z | supplier_a | StockReservationFailed | Northstar Supply could not reserve its last unit | retryable=true; simulated=true; reason=Supplier returned 409 |
| 6 | 2026-10-01T20:10:34.123Z | manager | PlanRevised | Manager switched to Harbor Works within the existing mandate | decisionMode=deterministic; rationale=Switching to Harbor Works: 35 DemoUSD and 4 days remain inside the mandate. |
| 7 | 2026-10-01T20:10:34.129Z | supplier_b | StockReserved | Harbor Works reserved the item | — |
| 8 | 2026-10-01T20:10:34.585Z | chain | EscrowFunded | 35 DemoUSD locked for Harbor Works | txHash=0x0b8eebf37e2f67fb76ec6651fb23d02d5c44a8507508da5bc158ccf67004adf6; mode=sandbox |
| 9 | 2026-10-01T20:10:35.039Z | supplier_b | SupplierAccepted | Harbor Works verified escrow and accepted the order | txHash=0xdbfe0699817d99253464be2bcfff37604f9679a3325b9ce9077681d3c24472da; mode=sandbox |
| 10 | 2026-10-01T20:10:35.493Z | system | LabelPrepared | Sandbox label prepared with tracking EZ2000000000d | tracking=EZ2000000000d; evidenceMode=sandbox |
| 11 | 2026-10-01T20:10:35.502Z | system | DispatchAttested | dispatch-d90f711a15970fc82150fb9f verified by the independent evidence service | evidenceMode=sandbox; occurredAt=2026-10-01T20:10:35.498Z; evidenceDigest=0xe49978c78d7afd48319e153317a6ff9e43c0d5831cbef9b59e5228ec4d67a36c |
| 12 | 2026-10-01T20:10:35.956Z | chain | SupplierPaid | 35 DemoUSD released to Harbor Works | txHash=0xadafe5e8fde783b9807b71cb917a6e32c115c8827a4967c0a011f9fd385138a0; mode=sandbox |
| 13 | 2026-10-01T20:10:35.957Z | chain | IndexerPending | Payment is confirmed; independent indexer reconciliation has been queued | txHash=0xadafe5e8fde783b9807b71cb917a6e32c115c8827a4967c0a011f9fd385138a0; reconciliationRequired=true |
| 14 | 2026-10-01T20:10:36.410Z | shopify | ShopifyFulfilmentConfirmed | Shopify fulfilment updated with EZ2000000000d | mode=sandbox; fulfillmentId=sandbox-fulfillment-sandbox-467bb6ff-2cfb-49b5-8091-705aceb4010d |
| 15 | 2026-10-01T20:10:36.865Z | manager | PurchaseCompleted | Supplier paid · shipment dispatched · Shopify reconciled | — |

## Verification note

This artifact is generated from the same persisted order snapshot used by the AfterOrder command center. It is an audit aid, not a production financial statement. Public-chain claims require a live-test run and independently resolvable explorer links.
