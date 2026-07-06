import { describe, expect, it } from "vitest";
import { summarizePortfolioPositions } from "@/lib/portfolio/snapshots";

describe("portfolio snapshots", () => {
  it("summarizes long market value, unrealized P/L, and open position count", () => {
    const summary = summarizePortfolioPositions([
      {
        symbol: "AAPL",
        qty: 0.25,
        marketValue: 50,
        avgEntryPrice: 190,
        unrealizedPnl: 2.5
      },
      {
        symbol: "MSFT",
        qty: 0,
        marketValue: 0,
        avgEntryPrice: 0,
        unrealizedPnl: -0.5
      },
      {
        symbol: "GOOG",
        qty: 0.1,
        marketValue: 20,
        avgEntryPrice: 175,
        unrealizedPnl: -1
      }
    ]);

    expect(summary.longMarketValue).toBe(70);
    expect(summary.unrealizedPnl).toBe(1);
    expect(summary.openPositionsCount).toBe(2);
  });
});
