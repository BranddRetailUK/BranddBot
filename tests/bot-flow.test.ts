import { describe, expect, it } from "vitest";
import { AIReasoningService } from "@/lib/ai/reasoning";
import { MockBroker } from "@/lib/broker/mock";
import { createNoopScanPersistence } from "@/lib/bot/persistence";
import { evaluateRiskGate } from "@/lib/bot/risk";
import { runBotScan } from "@/lib/bot/scan";
import { testConfig, testEnv, oversoldBars } from "@/tests/helpers";
import type { AiDecisionResult, MarketBar, RsiSignal, TradingContext } from "@/lib/types/trading";

describe("bot flow", () => {
  it("runs scan with mock broker and submits a paper order when all gates agree", async () => {
    const broker = new MockBroker();
    broker.bars.AAPL = oversoldBars();

    const aiService = new AIReasoningService({
      env: testEnv(),
      responsesCreate: async () => ({
        id: "resp_test",
        output_text: JSON.stringify({
          decision: "buy",
          confidence: 0.8,
          rationale: "RSI signal is aligned and exposure is below limits.",
          riskFlags: [],
          learningUpdate: {
            summary: "Paper buy approved under tight notional controls.",
            rewardSignal: 0.2,
            observations: ["Oversold pressure persisted."],
            mistakesToAvoid: []
          },
          recommendedParameterAdjustments: {
            rsiPeriod: 2,
            oversoldThreshold: 30,
            overboughtThreshold: 70,
            maxNotionalMultiplier: 1
          }
        })
      })
    });

    const result = await runBotScan({
      dryRun: false,
      broker,
      aiService,
      persistence: createNoopScanPersistence(),
      config: testConfig()
    });

    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0]?.riskGate.accepted).toBe(true);
    expect(broker.orders).toHaveLength(1);
    expect(broker.orders[0]?.symbol).toBe("AAPL");
  });

  it("skips OpenAI reasoning when deterministic RSI is hold", async () => {
    const broker = new MockBroker();
    broker.bars.AAPL = neutralBars();
    let openAiCalls = 0;

    const aiService = new AIReasoningService({
      env: testEnv(),
      responsesCreate: async () => {
        openAiCalls += 1;
        throw new Error("OpenAI should not be called for deterministic hold signals.");
      }
    });

    const result = await runBotScan({
      dryRun: false,
      broker,
      aiService,
      persistence: createNoopScanPersistence(),
      config: {
        ...testConfig(),
        oversoldThreshold: 0,
        overboughtThreshold: 100
      }
    });

    expect(openAiCalls).toBe(0);
    expect(result.symbols[0]?.signal.action).toBe("hold");
    expect(result.symbols[0]?.aiDecision.riskFlags).toContain("openai_skipped_for_deterministic_hold");
    expect(result.symbols[0]?.riskGate.accepted).toBe(false);
    expect(broker.orders).toHaveLength(0);
  });

  it("blocks live mode even when AI agrees", () => {
    const signal: RsiSignal = {
      symbol: "AAPL",
      action: "buy",
      rsi: 25,
      confidence: 0.7,
      reason: "RSI is oversold.",
      recommendedNotional: 10
    };
    const aiDecision: AiDecisionResult = {
      decision: "buy",
      confidence: 0.9,
      rationale: "Looks aligned.",
      riskFlags: [],
      learningUpdate: {
        summary: "No update.",
        rewardSignal: 0,
        observations: [],
        mistakesToAvoid: []
      },
      recommendedParameterAdjustments: {},
      configured: true,
      promptHash: "hash",
      inputJson: "{}",
      outputJson: "{}"
    };

    const result = evaluateRiskGate({
      signal,
      aiDecision,
      dryRun: false,
      context: baseContext(signal),
      config: {
        ...testConfig(),
        tradingMode: "live",
        liveTradingEnabled: false
      }
    });

    expect(result.accepted).toBe(false);
    expect(result.reasons.join(" ")).toContain("Live trading is disabled");
  });
});

function baseContext(signal: RsiSignal): TradingContext {
  return {
    symbol: signal.symbol,
    generatedAt: new Date().toISOString(),
    currentPrice: 100,
    barSummary: {
      timeframe: "5Min",
      count: 12,
      firstClose: 110,
      lastClose: 100,
      high: 111,
      low: 99,
      volume: 12000
    },
    rsi: {
      period: 2,
      current: signal.rsi,
      oversoldThreshold: 30,
      overboughtThreshold: 70
    },
    deterministicSignal: signal,
    account: {
      buyingPower: 1000,
      cash: 1000,
      portfolioValue: 1000
    },
    openPositionsCount: 0,
    recentTrades: [],
    realizedPnlToday: 0,
    riskLimits: testConfig().risk,
    priorLessons: [],
    researchBriefs: []
  };
}

function neutralBars(): MarketBar[] {
  const closes = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101];
  return closes.map((close, index) => ({
    timestamp: new Date(Date.UTC(2026, 0, 1, 14, index)).toISOString(),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000 + index
  }));
}
