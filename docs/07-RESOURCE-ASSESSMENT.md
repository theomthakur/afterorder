# Resource assessment

Source reviewed: supplied export of `https://hackathon.monad.xyz/resources`, dated
14 September 2026.

## What the document changes

The resource catalog confirms that Monad is actively supporting agent-oriented infrastructure:

- x402 for HTTP-native payments to APIs and agents
- ERC-8004 for agent identity and reputation
- EIP-7702 and smart-wallet patterns
- Alchemy wallet, webhook, CLI, MCP and agent tooling
- Envio indexing and agent skills
- Zerion wallet-analysis, signing and transaction skills
- Tenderly simulation and monitoring

It does **not** make every item appropriate for this project. Resources marked Monad Foundation
are official Monad material; the remainder are independent ecosystem references. Inclusion in
the catalog is not proof that an integration is deployed on Monad, safe, maintained or suitable.

## The key architecture boundary

AfterOrder currently contains two different kinds of agents:

1. Internal specialist roles operated by one merchant backend.
2. Potential external service agents operated by independent providers.

ERC-8004 is difficult to justify for the first group. Giving five prompts separate onchain
identities does not create meaningful trust when the same operator controls every prompt,
credential and tool.

ERC-8004 becomes useful for the second group: independently operated fulfilment, returns,
inspection, shipping or insurance services that must be discovered and evaluated across
organizational boundaries.

The same distinction applies to x402. It should be used only when an agent actually purchases
an API call or service over HTTP. It should not be claimed merely because the system also makes
ordinary authenticated Shopify or EasyPost API calls.

## Recommended minimum stack

| Need | Initial choice | Reason |
|---|---|---|
| Contracts and tests | Foundry | Fast contract tests, scripts and clear traces |
| Monad connection | One RPC provider | Avoid redundant infrastructure during the MVP |
| Transaction debugging | Tenderly | High-value provided perk; simulate failures before spending |
| Merchant wallet experience | One embedded/smart-wallet provider | Hide seed phrases and repeated approval prompts |
| Contract event feed | Envio only if the dashboard needs indexed history | Useful when it powers a visible product feature |
| External commerce trigger/result | Shopify development store | Real order/return environment with safe test orders |
| Logistics execution | EasyPost test mode, subject to spike | Real rates, labels and tracking without production shipment |

Choose either Privy, Alchemy Smart Wallets or another wallet stack after a small spike. Do not
integrate several wallet vendors.

## Conditional components

### ERC-8004

Use only if the MVP includes at least one independently represented service agent and the
workflow visibly uses its registered identity or reputation when selecting it.

Do not use it merely to assign identities to the manager, eligibility, economics and records
prompts inside one application.

### x402

Use only if a live external service endpoint requests and receives an x402 payment during the
demonstration. The paid service must return an output used by the workflow.

Do not describe a conventional SaaS subscription, Shopify API call or mocked HTTP response as
an x402 payment.

### Envio

Use if indexed contract events drive the authority trail, transaction timeline or 3D activity
view. Skip it if direct RPC reads are already reliable for the narrow demonstration.

### Zerion

Use only if cross-wallet holdings, token positions or transaction analysis affects a decision.
That is unlikely for the current commerce workflow, so it is excluded by default.

### Chainlink

Use only if an external fact must trigger an onchain state change and the relevant service is
confirmed live on Monad. The resource document itself warns that some automation paths may
require a self-run keeper.

## Problem revealed in the current AfterOrder proposal

If one merchant owns the backend, agents, Shopify credentials and Monad wallet, an onchain
permission check cannot prevent that same backend from bypassing the check and calling Shopify
directly. In that architecture Monad improves transparency but is not a fully independent
enforcement boundary.

Before finalizing AfterOrder, choose one of two honest directions:

### Direction A — product-first

Build excellent autonomous return or exception resolution across Shopify and EasyPost. Use a
Monad mandate and execution receipts as transparent governance, without claiming that the chain
alone makes unauthorized Shopify actions impossible.

### Direction B — protocol-first

Introduce independently operated service agents. The merchant agent discovers an agent through
ERC-8004, verifies its record, purchases a bounded service through x402, and settles or penalizes
performance onchain. Shopify supplies the real business trigger and receives the result.

Direction B makes Monad more necessary but materially increases scope. It should be selected
only if one narrow external service can be completed reliably.

## Strongest narrow protocol-first demonstration

1. A Shopify return request arrives.
2. The manager reads the merchant's resolution mandate.
3. It discovers two independently identified return-service agents.
4. It selects one using price, capability and ERC-8004 trust data.
5. It purchases the service through x402 within its delegated budget.
6. The service obtains a test return label and returns verifiable delivery data.
7. AfterOrder updates the Shopify return and records the completed execution.
8. A second attempt outside the mandate is rejected and visibly replanned.

This is more defensible than registering every internal specialist onchain, but it requires a
credible live service-agent boundary rather than two mocked personas in the same process.

## Resources deliberately excluded for now

- Aave, Morpho, Euler, Curvance and other lending/yield SDKs
- Kuru, 0x, Uniswap and other trading integrations
- Farcaster and React Native templates
- Social, gaming and collectible primitives
- Attestations, C2PA and proof-of-personhood components

They do not help the selected workflow. Adding them would increase surface area without making
the product more complete.

## Decision before implementation

Do not lock the contract architecture until choosing product-first or protocol-first. That is
now the most important project decision; it matters more than the 3D layout, agent count,
project title or sponsor bounty.
