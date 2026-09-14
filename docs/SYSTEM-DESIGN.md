# AfterOrder system design

AfterOrder turns a paid Shopify order into a bounded supplier purchase. It coordinates six
agents, two independent supplier services, a merchant mandate, dispatch-based escrow and final
Shopify fulfilment. This document describes the implemented prototype and clearly separates
local sandbox behavior from integrations that require external configuration.

## Design goals

1. Continue an order safely when the preferred supplier cannot reserve inventory.
2. Keep every supplier choice inside the merchant's price, delivery and supplier constraints.
3. Distinguish quotes, reservations, escrow, dispatch and fulfilment instead of treating them as
   one vague “completed” action.
4. Persist the workflow and expose every meaningful transition to the command center.
5. Never present a sandbox hash or simulated provider result as a live external operation.

## Context and components

```text
Shopify paid-order webhook                Merchant wallet
        |                                signed authorization
        +-------------------+--------------------+
                            v
                 AfterOrder orchestration API
          validation | state machine | policy | recovery
                            |
        +-------------------+---------------------+
        |                   |                     |
        v                   v                     v
  Supplier APIs       Monad contracts       Shopify Admin API
 quote/reserve/       mandate/escrow/        fulfilment update
 dispatch             evidence release
        +-------------------+---------------------+
                            v
                SQLite state and event history
                            |
                            v
                SSE -> React + 3D command center
```

The API is the only component allowed to change workflow state. Browser components display the
persisted snapshot and request an operation; they do not decide that an external action succeeded.

## Agent responsibilities

| Agent | Responsibility | Authority boundary |
|---|---|---|
| Manager | Coordinates the workflow and chooses a valid recovery offer | Cannot expand the mandate |
| Sourcing | Requests quotes and reserves the selected offer | Uses authenticated supplier APIs |
| Policy | Filters by supplier, price and delivery constraints | Deterministic checks own approval |
| Logistics | Tracks preparation, dispatch and evidence | Dispatch is a supplier result, not model text |
| Purchasing | Funds, accepts and releases escrow | Contract calls enforce payment transitions |
| Reconciliation | Updates and verifies fulfilment records | Completes only after payment and dispatch |

OpenRouter is optional and limited to phrasing or selecting among alternatives already proven
valid by code. If it is absent, unavailable or returns an invalid ID, deterministic selection
continues the order.

## Workflow state machine

```text
received -> validating -> sourcing -> reserving -> funding
  -> awaiting_supplier -> preparing_shipment -> awaiting_dispatch
  -> reconciling -> purchase_complete

Any unrecoverable error -> blocked
```

The canonical scenario deliberately exercises recovery:

1. Northstar quotes 32 DemoUSD and is initially eligible.
2. Its reservation rejects because another buyer took the final unit.
3. The failure and rejected offer remain in the event record.
4. The Manager considers only remaining in-stock offers within 40 DemoUSD and five days.
5. Harbor Works is selected at 35 DemoUSD, reserved and funded.
6. Dispatch evidence releases escrow, then Shopify fulfilment is reconciled.

## Persistence model

SQLite uses WAL mode and stores:

- `orders`: external ID, product, current workflow state and settlement fields;
- `agents`: status and latest summary for each agent per order;
- `offers`: supplier, price, delivery, stock and selection state;
- `events`: append-only narrative and structured metadata for every transition;
- `operations`: idempotency claims for external requests;
- `merchant_authorizations`: verified wallet messages and signatures.

Supplier inventory, quotes and reservations live in separate supplier databases. This prevents
the orchestrator from pretending it owns external inventory state.

## Trust and payment boundaries

- Shopify intake verifies the webhook HMAC and claims the webhook ID once.
- Supplier requests use a service bearer token and a four-second timeout.
- Policy code filters offers before the Manager sees recovery candidates.
- `MandateRegistry` holds spend and supplier authorization.
- `OrderEscrow` binds supplier, amount, deadline, evidence signer and order intent.
- Release requires signed dispatch evidence for the matching order intent.
- Customer and order detail stays offchain; the chain carries authority and settlement state.

## Failure handling

| Failure | Behavior |
|---|---|
| Preferred reservation rejected | Persist failure, re-filter alternatives and reserve the next valid offer |
| No valid alternative | Mark the order and Manager blocked with a visible event |
| Model unavailable or malformed | Use deterministic recovery and label the decision mode |
| Supplier timeout or non-2xx response | Reject the action; never convert it into success text |
| Repeated Shopify webhook | Return the original result without creating another purchase |
| Repeated local demonstration | Reset fixture supplier state before the new sandbox order |
| Missing live credentials | Remain in visibly labelled sandbox mode |

## Runtime modes

`sandbox` runs the full local workflow with real persistence and supplier HTTP services, but uses
labelled local results for Shopify and chain actions. `live_test` requires Shopify credentials,
the Monad RPC, deployed addresses and funded role wallets. The header reports the active mode.

Envio, Dynamic and OpenRouter are optional configured integrations. Their absence does not change
the truthfulness of the core workflow.

## Non-functional requirements

- **Integrity:** one state-changing authority and idempotent external intake.
- **Auditability:** every major transition becomes a timestamped event with an actor.
- **Recoverability:** expected inventory contention has a bounded alternate path.
- **Security:** secrets stay server-side; supplier and webhook requests are authenticated.
- **Responsiveness:** state changes stream to the browser through server-sent events.
- **Accessibility:** the journey and inspector remain useful if the 3D scene is unavailable.
- **Portability:** shared schemas keep browser and API states aligned.

## Verification

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm dev
corepack pnpm smoke
```

The automated suite covers the workflow rules, Shopify signature and duplicate protection, and
local-chain mandate and escrow behavior. The smoke test asserts the complete supplier-failover
journey and its required events.
