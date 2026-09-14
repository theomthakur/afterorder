# Idea shortlist

No idea is final yet. This file prevents enthusiasm for an interface or sponsor from replacing
problem selection.

## Candidate A — ReturnPilot

An autonomous Shopify returns operator. A customer requests a return or replacement; agents
verify eligibility, assess evidence, compare resolution costs, create a return label, execute
the refund or exchange, update inventory and reconcile the result.

External systems: Shopify and EasyPost.

Possible Monad role: identifiable specialist agents plus bounded, revocable authority over
refunds, replacements and logistics spending.

Strengths:

- Clear business pain with several genuinely different decisions.
- Starts and finishes in real external systems.
- A failure or policy rejection creates a strong demonstration.
- The normal path can operate without employee intervention.

Open risks:

- Onchain authority must gate real API mutations, not merely duplicate an audit log.
- Customer evidence analysis can become unreliable or safety-sensitive if oversold.
- Shopify development-store and EasyPost test-mode limits must be proven early.

## Candidate B — StorePilot

An autonomous Shopify fulfilment operator. A new order triggers inventory, supplier, logistics,
risk, payment, fulfilment and reconciliation agents.

External systems: Shopify plus a fulfilment provider such as Printify or Printful.

Strengths:

- Very complete order-to-fulfilment narrative.
- Straightforward Shopify-triggered demonstration.
- Supplier failure can demonstrate autonomous recovery.

Open risks:

- Routine fulfilment is already heavily automated, weakening the problem statement.
- A real supplier order may create charges or lack a safe sandbox.
- Monad can look attached rather than necessary unless authority gates execution.

## Candidate C — Delegation Chain

Infrastructure for creating, narrowing, exercising and revoking agent authority. A parent agent
may delegate only a strict subset of its own permissions, and revoking the parent invalidates
the complete descendant chain.

Strengths:

- Monad is unquestionably central.
- Small, testable and technically coherent.
- Direct fit for Trust, Identity & AI Infrastructure.

Open risks:

- Infrastructure alone lacks the external operational environment Om wants.
- It can feel like a contract demonstration rather than a finished product.
- It needs one compelling application instead of several shallow examples.

## Candidate D — Shopify exception control tower

Agents resolve fulfilment exceptions after an order is delayed, rejected, out of stock or
undeliverable. They select an allowed recovery path, update Shopify and notify the customer.

Strengths:

- Better problem than automating the happy path.
- Naturally demonstrates retries, replanning and measurable completion.

Open risks:

- Requires credible supplier or carrier failure signals.
- Can expand into too many exception types.
- Must finish one resolution rather than render a simulated operations dashboard.

## Current comparison

Scores are provisional and must be replaced by technical spikes and user evidence.

| Test | ReturnPilot | StorePilot | Delegation Chain | Exception tower |
|---|---:|---:|---:|---:|
| Clear real problem | 5 | 3 | 4 | 5 |
| Agents perform distinct work | 5 | 4 | 3 | 5 |
| External end-to-end result | 5 | 5 | 2 | 4 |
| Monad is indispensable | 4 | 3 | 5 | 4 |
| Safe test demonstration | 4 | 3 | 5 | 3 |
| Scope discipline | 4 | 3 | 5 | 3 |
| **Provisional total** | **27** | **21** | **24** | **24** |

## Current recommendation

Validate **ReturnPilot** first, but retain Delegation Chain as its authorization primitive.
Do not create the portal project under either name until the Shopify mutation path, test-mode
logistics path and Monad enforcement boundary have been demonstrated in small spikes.
