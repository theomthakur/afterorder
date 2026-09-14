# Finalization gate

The project is ready to name and build only when every required question has a concrete answer.

## Problem

- [ ] Can the problem be stated in one sentence without mentioning agents, blockchain or 3D?
- [ ] Who experiences it, and what do they do manually today?
- [ ] Is it frequent, expensive, slow or risky enough to justify a product?
- [ ] What single workflow will the prototype complete?

## Agentic execution

- [ ] Does each agent own a different decision, tool or result?
- [ ] Does the manager delegate and replan rather than call every agent in a fixed sequence?
- [ ] Can the happy path finish without per-step human approval?
- [ ] Can the system recover from one real tool failure or rejected action?
- [ ] Are deterministic checks implemented as code rather than unnecessary model calls?

## External integration

- [ ] What external event starts the workflow?
- [ ] Which external API receives the final result?
- [ ] Can the complete flow run safely with development or test accounts?
- [ ] Do we have access to every required API and permission?
- [ ] Does the demonstration use real API responses rather than prerecorded success objects?

## Monad necessity

- [ ] What breaks if Monad is replaced with a private database?
- [ ] Is an agent's authority checked before the external action executes?
- [ ] Can authority be narrowed, expired and revoked?
- [ ] Does revoking a parent invalidate downstream authority?
- [ ] Can a judge inspect the identity, mandate and execution transaction?
- [ ] Are x402 or ERC-8004 used because the workflow needs them, not because they are listed?

## Demonstration

- [ ] Can an outsider understand the problem in 15 seconds?
- [ ] Is there one visible external trigger?
- [ ] Do agents produce observable work rather than animated conversation?
- [ ] Is there one failure, autonomous recovery and completed result?
- [ ] Can the full demonstration fit within two minutes if required?
- [ ] Does the 3D view reflect backend state and remain optional to execution?

## Decision rule

Reject any concept that fails one of these three tests:

1. It cannot finish a real external workflow.
2. Monad is only an audit trail or payment ornament.
3. Removing the agents would leave an ordinary fixed automation with the same value.

## First validation spikes

Run these before architecture or UI work:

1. Create a Shopify development store and prove receipt of a real order or return webhook.
2. Prove one safe Shopify Admin API mutation relevant to the chosen workflow.
3. Prove a test shipment/label or supplier action without incurring an unintended charge.
4. Deploy a minimal Monad contract that grants, narrows, checks and revokes authority.
5. Gate the external mutation on the contract result and record both identifiers together.
