# Security notes

AfterOrder is a hackathon prototype using synthetic commerce data and a valueless demo token.
It is not ready to hold real funds or process customer information.

## Secrets

- Keep `.env` local. Commit only `.env.example` placeholders.
- Use separate merchant, execution, supplier and evidence-signing keys.
- Never expose Shopify, OpenRouter, RPC or private-key values in the browser bundle.
- Rotate any credential copied into chat, screenshots, logs or a public issue.

## Current controls

- Shopify webhooks are verified against their exact raw body and deduplicated.
- Supplier calls use service credentials and persist their own inventory state.
- Contract tests cover an unapproved supplier rejection and a bounded payment release.
- Physical dispatch is represented by signed evidence; the UI does not equate an agent action
  with real-world delivery.
- Live integrations stay disabled until every required setting is present.

## Known prototype limitations

- DemoUSD minting is intentionally unrestricted because it has no value.
- Local SQLite is not a production-grade queue or high-availability store.
- The optional Dynamic SDK currently brings transitive audit findings from wallet dependencies.
  Keep it isolated, monitor upstream fixes and reassess before production use.
- Production deployment still needs replay protection reviews, contract audit, rate limits,
  managed keys, least-privilege identities and incident monitoring.

Please report a vulnerability privately to the repository owners rather than opening a public
issue containing exploit details or credentials.
