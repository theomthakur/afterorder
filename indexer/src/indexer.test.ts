import { describe, expect, it } from "vitest";
import { createTestIndexer, TestHelpers } from "envio";

const orderId = `0x${"11".repeat(32)}`;
const evidenceDigest = `0x${"22".repeat(32)}`;

describe("AfterOrder escrow indexer", () => {
  it("stores a release under the order key used by API reconciliation", async () => {
    const indexer = createTestIndexer();
    await indexer.process({
      chains: {
        10143: {
          simulate: [{
            contract: "OrderEscrow",
            event: "OrderReleased",
            params: {
              id: orderId,
              supplier: TestHelpers.Addresses.mockAddresses[0]!,
              amount: 35_000_000n,
              evidenceDigest,
            },
          }],
        },
      },
    });

    const release = await indexer.OrderRelease.getOrThrow("10143_0_0");
    expect(release).toMatchObject({
      orderId,
      supplier: TestHelpers.Addresses.mockAddresses[0]!.toLowerCase(),
      amount: 35_000_000n,
      evidenceDigest,
      chainId: 10143,
    });
  });

  it("keeps refund state as a separate auditable event", async () => {
    const indexer = createTestIndexer();
    await indexer.process({
      chains: {
        10143: {
          simulate: [{
            contract: "OrderEscrow",
            event: "OrderRefunded",
            params: {
              id: orderId,
              merchant: TestHelpers.Addresses.mockAddresses[1]!,
              amount: 35_000_000n,
            },
          }],
        },
      },
    });
    expect(await indexer.OrderRefund.getOrThrow("10143_0_0")).toMatchObject({ orderId, amount: 35_000_000n });
  });
});
