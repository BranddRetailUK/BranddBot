import { describe, expect, it } from "vitest";
import { MockBroker } from "@/lib/broker/mock";
import { submitManualPaperBuy } from "@/lib/trading/manualOrder";
import { testConfig } from "@/tests/helpers";

const asset = {
  symbol: "AAPL",
  name: "Apple Inc.",
  exchange: "NASDAQ",
  tradable: true,
  fractionable: true
};

describe("manual paper orders", () => {
  it("submits a user-directed paper buy and records no database rows when persist is false", async () => {
    const broker = new MockBroker();
    const order = await submitManualPaperBuy({
      symbol: "AAPL",
      notional: 50,
      broker,
      config: testConfig(),
      asset,
      persist: false
    });

    expect(order.symbol).toBe("AAPL");
    expect(order.side).toBe("buy");
    expect(order.notional).toBe(50);
    expect(broker.orders).toHaveLength(1);
  });

  it("blocks manual buys outside paper safety mode", async () => {
    await expect(
      submitManualPaperBuy({
        symbol: "AAPL",
        notional: 50,
        broker: new MockBroker(),
        config: {
          ...testConfig(),
          tradingMode: "live"
        },
        asset,
        persist: false
      })
    ).rejects.toThrow("paper mode");
  });
});
