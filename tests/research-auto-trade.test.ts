import { describe, expect, it } from "vitest";
import { runResearchAutoTrade, type ResearchAutoTradeOpportunityInput } from "@/lib/bot/researchAutoTrade";
import { MockBroker } from "@/lib/broker/mock";
import { testConfig } from "@/tests/helpers";
import type { ResearchAutoTradeConfig } from "@/lib/types/trading";

const enabledResearchConfig: ResearchAutoTradeConfig = {
  enabled: true,
  minConfidence: 0.55,
  minScore: 0.45,
  notionalPerOrder: 1,
  maxItemsPerRun: 1,
  maxOpenPositions: 25,
  maxDailyOrders: 100,
  symbolCooldownMinutes: 60
};

describe("research auto-trade executor", () => {
  it("selects source-backed positive research outside the RSI watchlist in paper mode", async () => {
    const broker = new MockBroker();
    const result = await runResearchAutoTrade({
      dryRun: true,
      broker,
      config: testConfig(),
      researchConfig: enabledResearchConfig,
      now: new Date(Date.UTC(2026, 0, 1, 15)),
      account: broker.account,
      positions: [],
      opportunities: [bullishOpportunity("NVDA")],
      recentResearchTrades: [],
      dailyResearchTradeCount: 0,
      realizedPnlToday: 0,
      persist: false
    });

    expect(result.submittedOrders).toBe(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.symbol).toBe("NVDA");
    expect(result.items[0]?.action).toBe("buy");
    expect(result.items[0]?.accepted).toBe(true);
    expect(result.items[0]?.orderRequest?.notional).toBe(1);
    expect(broker.orders).toHaveLength(0);
  });

  it("blocks research auto-trading outside paper mode", async () => {
    const broker = new MockBroker();
    const result = await runResearchAutoTrade({
      dryRun: false,
      broker,
      config: {
        ...testConfig(),
        tradingMode: "live"
      },
      researchConfig: enabledResearchConfig,
      opportunities: [bullishOpportunity("AAPL")],
      persist: false
    });

    expect(result.items[0]?.accepted).toBe(false);
    expect(result.items[0]?.reasons.join(" ")).toContain("paper mode");
    expect(broker.orders).toHaveLength(0);
  });

  it("submits a small paper order when enabled and limits pass", async () => {
    const broker = new MockBroker();
    const result = await runResearchAutoTrade({
      dryRun: false,
      broker,
      config: testConfig(),
      researchConfig: enabledResearchConfig,
      now: new Date(Date.UTC(2026, 0, 1, 15)),
      account: broker.account,
      positions: [],
      opportunities: [bullishOpportunity("AAPL")],
      recentResearchTrades: [],
      dailyResearchTradeCount: 0,
      realizedPnlToday: 0,
      persist: false
    });

    expect(result.submittedOrders).toBe(1);
    expect(result.items[0]?.accepted).toBe(true);
    expect(result.items[0]?.order?.id).toBe("mock-order-1");
    expect(broker.orders).toHaveLength(1);
    expect(broker.orders[0]?.notional).toBe(1);
  });
});

function bullishOpportunity(symbol: string): ResearchAutoTradeOpportunityInput {
  return {
    id: `opp-${symbol.toLowerCase()}`,
    symbol,
    direction: "bullish",
    thesis: `${symbol} has positive source-backed news.`,
    catalyst: "upgrade, launch",
    confidence: 0.72,
    score: 0.72,
    riskFlags: [],
    expiresAt: new Date(Date.UTC(2026, 0, 2)),
    sourceUrls: [`https://example.com/${symbol.toLowerCase()}`]
  };
}
