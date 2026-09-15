# AfterOrder review fixes

Deferred remediation plan, verified against the repository on 14 September 2026.

This records the next implementation pass. It does not claim these changes are already built.
The sandbox demo remains usable for product conversations, but simulated supplier failure,
local signatures and sandbox settlement must not be presented as live production behavior.

## Progress on 15 September 2026

Completed locally in the first remediation pass:

- Merchant-selected evidence signer is stored in the mandate and inherited by child mandates.
- The purchaser can no longer select the evidence signer while funding an order.
- A separate evidence service checks supplier dispatch state before signing; the purchasing API
  no longer reads the verifier private key.
- Expired-order refunds restore reusable mandate allocation exactly once.
- Offer policy calls `previewSpend` in live mode instead of trusting the former hardcoded limit.
- Envio delay or mismatch is recorded separately and can no longer mark a paid order blocked.
- Dynamic intent signatures now use server-created, expiring, single-use nonces.
- OpenRouter planning is disabled by default and requires `ENABLE_MODEL_PLANNER=true`.
- Slack leftovers were removed from active configuration and the master-plan environment list.
- Contract coverage now includes independent signing, evidence replay, refunds, limit enforcement
  and revocation; Envio lag and mismatch have unit coverage.

Completed in the second remediation pass:

- Dynamic submits demo-token funding, escrow deposit and the actual `grantRoot` transaction from
  the connected merchant wallet; the API verifies ownership before activating the mandate.
- Workflow stages checkpoint to SQLite and unfinished jobs resume when the API starts.
- Supplier quote IDs, expirations and wallet addresses persist across restarts.
- Envio reconciliation uses a separate persisted queue with exponential retry scheduling.
- A manual resume endpoint retries recoverable blocked workflows without creating another job.

Still outstanding:

- Corrected contracts must be deployed and exercised on Monad testnet.
- Live Shopify, Dynamic and Envio configuration and the final hosted demonstration remain.

## Goal

Make AfterOrder's trust story true end to end:

> A merchant grants bounded purchasing authority, independent parties provide evidence, and the
> system can execute and recover autonomously without being able to approve its own payments.

The primary target remains **Trust, Identity & AI Infrastructure**. Dynamic, Envio and model
integrations must perform substantive work rather than appear as disconnected demonstrations.

## Decisions to lock first

1. The purchasing/orchestration service must not control the dispatch-evidence signing key.
2. A supplier must not be the sole authority that releases its own payment. Use an independent
   carrier or fulfilment verifier, or require supplier evidence plus independent attestation.
3. The merchant creates the onchain mandate from a Dynamic wallet, either directly or through a
   narrowly scoped EIP-712 authorization verified by a relayer.
4. Contract rules and ordinary server code enforce budgets, identities, transitions and replay
   protection. A model may plan, select tools, explain and recover, but cannot override them.
5. Payment state and indexing state are separate. Indexer delay cannot turn a completed payment
   into a blocked order.
6. Decide whether the mandate is a cumulative spending cap or reusable exposure cap. For a
   reusable budget, a valid refund must restore capacity exactly once.

## Implementation sequence

### 1. Redesign evidence authority

- Store the merchant-selected evidence verifier onchain when a mandate or order is created.
- Move its private key outside the purchaser API and orchestration runtime.
- Bind each attestation to chain ID, contract, order ID, mandate ID, evidence digest, action,
  nonce and expiry.
- Reject expired evidence, an unassigned signer and reuse of evidence.
- Persist the evidence payload, signer and resulting transaction hash in the audit trail.

Exit check: neither purchaser nor supplier can release payment alone, and replay fails in a
contract test.

### 2. Connect merchant authorization to the mandate

- Replace the disconnected stored message with a Dynamic-wallet `grantRoot` transaction or an
  EIP-712 authorization submitted by a relayer.
- Include nonce, expiry, chain ID, verifying contract, token, budget, allowed suppliers and
  permitted actions in the authorization.
- Display wallet, network, budget and transaction state before confirmation.
- Treat rejected signatures, wrong networks and expired authorizations as recoverable states.

Exit check: a fresh Dynamic wallet creates a mandate; replay, wrong-chain and expired
authorizations fail safely.

### 3. Correct budget and refund semantics

- Make the policy tool query the mandate and call `previewSpend`; remove the hardcoded `$40`
  workflow decision.
- If refunded value is reusable, add an escrow-only restoration path associated with the
  original order and mandate.
- Prevent double restoration and restoration before a valid refund.
- Show remaining onchain authority in the UI.

Exit check: over-limit spending is rejected onchain and the chosen refund behavior is tested and
described plainly in the README.

### 4. Replace the scripted workflow with durable orchestration

- Model the journey as persisted jobs and events rather than one function with artificial delays.
- Give the planner bounded tools for quotes, mandate inspection, reservation, settlement and
  reconciliation.
- Let it reconsider suppliers after a real or explicitly simulated reservation failure.
- Keep retries, idempotency, arithmetic and authorization deterministic.
- Record proposed actions, tool results, retries and reasons for the UI.
- Apply visual pacing only in a clearly labelled demo mode.

Exit check: restarting during an order resumes without duplicate reservation or payment, and the
demo explains why the supplier changed.

### 5. Separate settlement from indexer reconciliation

- Record payment immediately after chain confirmation.
- Add `indexing_pending`, `indexed` and `indexing_failed` reconciliation states.
- Poll Envio with bounded exponential backoff and persist attempts.
- Never downgrade a paid order to `blocked` because Envio has not indexed it.
- Show chain and indexer confirmation separately.

Exit check: a delayed indexer leaves the order paid and pending, then indexes it without rerunning
payment.

### 6. Expand automated coverage

Add tests for:

- supplier reservation failure and successful failover;
- spending exactly at and above the mandate limit;
- revocation before reservation, funding and release;
- valid refund, double refund and budget restoration;
- wrong evidence signer, expired evidence and evidence replay;
- duplicate Shopify webhook and duplicate workflow execution;
- Dynamic nonce replay, expiry and wrong-network authorization;
- Envio delay, temporary failure and permanent mismatch;
- restart during every externally visible stage.

Exit check: contract, API, workflow and browser suites pass from a clean checkout without funded
credentials. Live-network checks remain explicit and separate.

### 7. Deploy and collect real evidence

- Deploy corrected contracts to Monad testnet using separate, funded role wallets.
- Run one real mandate creation, escrow funding, supplier acceptance, attestation and release.
- Store contract addresses and transaction links in a deployment record without keys.
- Configure Envio for those contracts and verify projected events.
- Run the UI journey from persisted backend and chain events.

Exit check: judges can follow public transaction links for the order shown in the demo.

### 8. Finish sponsor evidence and cleanup

- Demonstrate Dynamic authorizing the mandate, not login alone.
- Demonstrate Envio driving reconciliation and the 3D journey, not a separate data page.
- Use the selected model for substantive planning or recovery and retain an inspectable trace.
- Label Northstar failure as a simulated stock race when the forced flag is enabled.
- Remove unused Slack variables and other SafeSlackForce remnants.
- Update the README working/sandbox table and record actual model and infrastructure costs.

Exit check: every sponsor claim points to a working interaction, relevant code and demo evidence.

## Delivery checkpoints

| Checkpoint | Outcome |
|---|---|
| A. Trust model | Independent evidence and merchant-bound authorization designed and tested |
| B. Local correctness | Contract and workflow failure matrix passes locally |
| C. Wallet path | Dynamic wallet creates a real mandate |
| D. Live chain | Corrected contracts and one full order run on Monad testnet |
| E. Projection | Envio catches up independently without corrupting payment state |
| F. Submission | Hosted flow, transaction evidence, two-minute demo and README agree |

Do not advance while a financial invariant in the current checkpoint is failing.

## Demo acceptance flow

1. Merchant connects a Dynamic wallet and grants a visible budget and supplier allowlist.
2. A paid Shopify order arrives once despite webhook retry.
3. The planner gets offers and selects Northstar within the onchain mandate.
4. Northstar encounters a clearly labelled simulated stock race.
5. The planner reads the new state, selects Harbor and reserves the item.
6. Escrow is funded and Harbor accepts the order.
7. Independent dispatch evidence authorizes release; neither purchaser nor supplier can approve
   payment alone.
8. Monad confirms payment while the UI separately shows Envio catching up.
9. The order journey and system-design view show the same events and transaction IDs.

## Non-goals for this pass

- Production custody or mainnet funds.
- A general marketplace or consumer shopping application.
- Medical, insurance or workplace-incident workflows from earlier projects.
- Extra chains or sponsor integrations that do not strengthen the core order flow.
- Letting an LLM make unbounded financial or authorization decisions.

## Completion definition

This plan is complete only when the trust boundaries exist in deployed code, the failure matrix
passes, the end-to-end Monad transaction is public, and the README and demo make no stronger
claim than the evidence supports.
