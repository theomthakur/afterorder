# Envio HyperIndex handoff

Generate this indexer only after `OrderEscrow` is deployed. Current Envio HyperIndex requires
Node 22 or newer; the main prototype currently runs on Node 18.

1. Switch to Node 22 and run `pnpx envio init` in this directory.
2. Choose **Contract Import**, then **Local ABI**.
3. Use `../artifacts/contracts/OrderEscrow.json` and the deployed escrow address.
4. Use custom EVM chain ID `10143` and the Alchemy Monad RPC as the realtime RPC.
5. Index `OrderFunded`, `OrderAccepted`, `OrderReleased` and `OrderRefunded` from the deployment
   block.
6. Name the release entity `OrderRelease` with `orderId`, `supplier`, `amount`,
   `transactionHash`, block and timestamp fields; this matches the API's verification query.
   Do not store customer names, addresses or Shopify IDs onchain.
7. Add `ENVIO_API_TOKEN` for local HyperSync, run the generated tests, then `pnpm dev`.
8. Put the resulting GraphQL endpoint in `ENVIO_GRAPHQL_URL` and restart AfterOrder.

This directory is intentionally a handoff rather than fake generated code. Generated handler
types depend on the deployed address, selected events and the current Envio CLI.
