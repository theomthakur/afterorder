# AfterOrder Envio indexer

This package indexes the `OrderEscrow` lifecycle on Monad testnet. It stores funded,
accepted, released and refunded events. The API uses `OrderRelease` to independently
reconcile a supplier payment after the transaction has succeeded.

## Activate after contract deployment

1. Replace the placeholder address in `config.yaml` with `ORDER_ESCROW_ADDRESS`.
2. Replace `start_block: 0` with the deployment block printed by `pnpm contracts:deploy`.
3. Create an Envio API token at <https://envio.dev/app/api-tokens> and copy
   `.env.example` to `.env` inside this directory.
4. Use Node 22 or newer, then run:

```bash
corepack pnpm install
corepack pnpm codegen
corepack pnpm test
corepack pnpm dev
```

The local GraphQL endpoint is normally `http://localhost:8080/v1/graphql`. Put the
actual endpoint in the root `ENVIO_GRAPHQL_URL`. Envio Cloud can be used instead of
the local Docker runtime.

No Shopify customer data is indexed. Only contract event identifiers, supplier
wallets, token amounts, transaction hashes and block metadata are stored.
