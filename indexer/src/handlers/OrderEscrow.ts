import { indexer } from "envio";
import type { OrderAcceptance, OrderFunding, OrderRefund, OrderRelease } from "envio";

const eventId = (event: { chainId: number; block: { number: number }; logIndex: number }) =>
  `${event.chainId}_${event.block.number}_${event.logIndex}`;

indexer.onEvent({ contract: "OrderEscrow", event: "OrderFunded" }, async ({ event, context }) => {
  const entity: OrderFunding = {
    id: eventId(event),
    orderId: event.params.id.toLowerCase(),
    mandateId: event.params.mandateId.toLowerCase(),
    supplier: event.params.supplier.toLowerCase(),
    token: event.params.token.toLowerCase(),
    amount: event.params.amount,
    intentHash: event.params.intentHash.toLowerCase(),
    transactionHash: event.transaction.hash.toLowerCase(),
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
  };
  context.OrderFunding.set(entity);
});

indexer.onEvent({ contract: "OrderEscrow", event: "OrderAccepted" }, async ({ event, context }) => {
  const entity: OrderAcceptance = {
    id: eventId(event),
    orderId: event.params.id.toLowerCase(),
    supplier: event.params.supplier.toLowerCase(),
    transactionHash: event.transaction.hash.toLowerCase(),
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
  };
  context.OrderAcceptance.set(entity);
});

indexer.onEvent({ contract: "OrderEscrow", event: "OrderReleased" }, async ({ event, context }) => {
  const entity: OrderRelease = {
    id: eventId(event),
    orderId: event.params.id.toLowerCase(),
    supplier: event.params.supplier.toLowerCase(),
    amount: event.params.amount,
    evidenceDigest: event.params.evidenceDigest.toLowerCase(),
    transactionHash: event.transaction.hash.toLowerCase(),
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
  };
  context.OrderRelease.set(entity);
});

indexer.onEvent({ contract: "OrderEscrow", event: "OrderRefunded" }, async ({ event, context }) => {
  const entity: OrderRefund = {
    id: eventId(event),
    orderId: event.params.id.toLowerCase(),
    merchant: event.params.merchant.toLowerCase(),
    amount: event.params.amount,
    transactionHash: event.transaction.hash.toLowerCase(),
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
  };
  context.OrderRefund.set(entity);
});
