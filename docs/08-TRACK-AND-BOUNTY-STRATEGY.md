# Track and bounty strategy

Updated 14 September 2026 from Om's pasted primary-track and sponsor criteria. This document
supersedes earlier informal bounty suggestions. All integrations below are planned, not built.
The folder contains planning documents only. No award selection or project submission has been
made in the portal. No Alchemy, Envio or Zerion connector is callable in this assistant session.

## Primary category

The supplied portal says one primary category defines the project's main judging category.
Select one primary track and the compatible sponsor bounties whose requirements the completed
project meets. Do not assume awards can be combined without checking the complete rules.

Recommended target: **Trust, Identity & AI Infrastructure**, conditional on delivering a reusable
agent authorization and service-payment component. The supplied definition calls for protocol-level
primitives and value that is not captured by one platform. A Shopify returns app alone is a weak
fit. The contract and service authorization interface should be usable by a second integration
without relying on AfterOrder's private database to establish onchain spending authority.

AfterOrder is the concrete commerce application demonstrating this component. Keep customer data
offchain. The contract controls onchain service payments; a credential-holding API gateway enforces
Shopify permissions. Do not claim blockchain prevents a merchant or credential holder bypassing
that gateway, or proves that a physical package has arrived.

Consumer Products & Payments is a secondary possibility if the delivered product instead puts
customer-facing onchain payments at its center. It is not an automatic fit merely because the
application uses Shopify: ordinary card refunds plus incidental blockchain logs would be weak.
Finance/Trading and Social/Culture do not fit the selected workflow.

## Initial targets

| Award | Listed prize | Planned qualifying work | Evidence needed |
|---|---|---|---|
| Dynamic | $5,000 USD | Merchant authentication, embedded wallet and real signing of a service-budget authorization in the deployed app | Login, wallet interaction and resulting transaction; network and session support verified before adopting |
| Envio | $1,000 USD | Index real mandate, revocation and service-payment events to drive the dashboard's budget and execution history | Onchain event changes visible in indexed data and the core UI |
| Alchemy | $1,000 Alchemy credits | Use Monad RPC for application reads, transaction submission and receipt reconciliation | Deployed Monad application, integration code and successful receipt reads |
| KIMI | $3,000 credits | Use KIMI for manager planning, interpretation and recovery in actual application execution | Model configuration, redacted tool traces and evaluation examples; confirm acceptable provider route in full bounty terms |

Use one wallet provider. Dynamic is the initial candidate, subject to a network/signing spike;
Privy is an alternative if it better supports bounded unattended execution. Do not install both
only to seek two wallet awards. No provider choice is finalized by this planning document.

## Conditional awards and exclusions

| Award | Decision | Reason |
|---|---|---|
| Community Team Project — $5,000 USD | Conditional | Must establish that the team qualifies through a listed Metropolis community supporter; NYC residence or attendance alone is not evidence |
| Chainlink CRE — $3,000 USD | Stretch | Only if an actual CRE workflow owns a useful orchestration step such as retrieving execution evidence and reporting its digest onchain; verify runtime/network support. Calling a Chainlink API alone is insufficient |
| Privy — $5,000 USD | Alternative to Dynamic | Must go beyond login, such as delegated wallet signing or service payments |
| Mera UX — $2,500 USD | Alternative account architecture | Requires Mera as the entire account layer with no custody backend; cannot bolt it onto a separate custody design |
| Mera PRF — $2,500 USD | Defer | Needs a creative non-wallet use of PRF-derived keys; ordinary passkey login does not meet this description |
| Aurora Intents — $5,000 USD | Defer | Only if any-chain funding becomes a core merchant onboarding requirement; adds cross-chain scope |
| Nansen — $5,000 total pool | Defer | Wallet analytics currently do not establish product-return eligibility or supplier quality |
| Qwen 3.8 Max — $5,000 credits | Alternative model target | Restricted to Trust track; exact model access and terms need verification. Must perform substantive agent work |
| Agora cross-border — $10,000 USD | Exclude | Requires mobile AUSD remittances and Mera onboarding |
| Agora trading — $10,000 USD | Exclude | Requires mobile Mera/AUSD/Perpl trading |
| Cleanverse — $2,000 USD | Exclude | Requires gating CVA asset movements through CVI verification; ordinary customer authentication is insufficient |
| Both Kuru awards — $5,000 USD each | Exclude | Require spot trading/order-book products or markets |
| Perpl API — $5,000 USD | Exclude | Despite All tracks label, substantive requirement is a production-ready Perpl trading bot/automation |
| Perpl analytics — $3,000 USD | Exclude | Requires a Perpl-focused risk/analytics experience |
| Hunyuan — $2,000 Tencent vouchers | Exclude | Restricted to Social/Culture; a 3D interface alone is insufficient |
| MetaMask Agent Wallet Plugin — $2,500 USD | Exclude | Restricted to Finance/Trading and requires a new trading capability through the Agent Wallet plugin architecture |

## Development resources versus runtime integrations

Alchemy MCP and coding-agent skills can help the developers inspect chain state and write the
integration. They are not implemented product agents and do not automatically prove bounty
eligibility. Envio skills can help build the indexer; the running indexer must still power a
core application feature. Zerion tooling is unnecessary unless wallet intelligence becomes useful.

Alchemy's current official MCP documentation requires account sign-in via OAuth. "No API key"
does not mean anonymous access, unrestricted usage or free infrastructure.

QuickNode, Tenderly and Zerion offers are access perks, not cash winnings. Verify network and
product support before relying on a perk. If Alchemy is the runtime RPC, QuickNode need not be
added as a redundant provider solely because its voucher exists. Tenderly can assist contract QA
when the chosen network and operation are supported.

## Execution order

1. Prove a Shopify request and a safe external result with development accounts.
2. Implement the reusable authorization/service-payment interface and a real Monad transaction.
3. Prove Dynamic or Privy supports the selected account flow; choose one.
4. Make Envio data power the visible budget, revocation and payment history.
5. Evaluate KIMI on real case interpretation and tool-use examples; choose by results and cost.
6. Add CRE only if a defined workflow improves the existing architecture and remains feasible.
7. Recheck full eligibility, required deployment network, deliverables and award-stacking rules.
8. Submit evidence for every selected bounty: code path, live behavior, transaction and short demo.

Target one primary category and three core sponsor submissions, with a fourth model submission
if KIMI is adopted. Winning is the objective, not a guaranteed outcome. Do not total candidate
prizes as expected income or treat the track's $30,000 pool as one guaranteed team award.

## Sources

- Primary category and award terms: Om's pasted Metropolis portal list, 14 September 2026.
- Alchemy MCP: https://www.alchemy.com/docs/alchemy-mcp-server (reviewed 14 September 2026).
- Envio Monad support: https://envio.dev/chains/monad (reviewed 14 September 2026).
