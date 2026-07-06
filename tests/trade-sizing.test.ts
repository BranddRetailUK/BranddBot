import { describe, expect, it } from "vitest";
import {
  applyTradeSizingToBotConfig,
  applyTradeSizingToResearchAutoTradeConfig,
  normalizeTradeSizingSettings
} from "@/lib/trading/tradeSizing";
import { testConfig } from "@/tests/helpers";
import type { ResearchAutoTradeConfig } from "@/lib/types/trading";

const researchConfig: ResearchAutoTradeConfig = {
  enabled: true,
  minConfidence: 0.55,
  minScore: 0.45,
  notionalPerOrder: 1,
  minNotionalPerOrder: 1,
  maxNotionalPerOrder: 1,
  maxItemsPerRun: 1,
  maxOpenPositions: 25,
  maxDailyOrders: 100,
  symbolCooldownMinutes: 60
};

describe("trade sizing settings", () => {
  it("normalizes bid range and keeps max above min", () => {
    expect(normalizeTradeSizingSettings({ minBidNotional: 50, maxBidNotional: 25 })).toEqual({
      minBidNotional: 50,
      maxBidNotional: 50
    });
  });

  it("applies dashboard sizing to bot and research auto-trade configs", () => {
    const botConfig = applyTradeSizingToBotConfig(testConfig(), {
      minBidNotional: 25,
      maxBidNotional: 100
    });
    const sizedResearchConfig = applyTradeSizingToResearchAutoTradeConfig(researchConfig, {
      minBidNotional: 25,
      maxBidNotional: 100
    });

    expect(botConfig.risk.maxNotionalPerOrder).toBe(100);
    expect(botConfig.risk.maxPositionNotionalPerSymbol).toBe(100);
    expect(sizedResearchConfig.minNotionalPerOrder).toBe(25);
    expect(sizedResearchConfig.maxNotionalPerOrder).toBe(100);
    expect(sizedResearchConfig.notionalPerOrder).toBe(100);
  });
});
