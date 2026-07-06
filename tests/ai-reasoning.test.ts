import { describe, expect, it } from "vitest";
import { AIReasoningService, parseAiDecision } from "@/lib/ai/reasoning";
import { testEnv } from "@/tests/helpers";
import type { TradingContext } from "@/lib/types/trading";

describe("AIReasoningService", () => {
  it("parses strict OpenAI decision JSON", () => {
    const decision = parseAiDecision(
      JSON.stringify({
        decision: "buy",
        confidence: 0.82,
        rationale: "RSI confirms an oversold setup with limited exposure.",
        riskFlags: ["paper_only"],
        learningUpdate: {
          summary: "Oversold recovery remains worth tracking.",
          rewardSignal: 0.2,
          observations: ["Momentum stabilized."],
          mistakesToAvoid: ["Do not average up past the position cap."]
        },
        recommendedParameterAdjustments: {
          rsiPeriod: 2,
          oversoldThreshold: 30,
          overboughtThreshold: 70,
          maxNotionalMultiplier: 0.8
        }
      })
    );

    expect(decision.decision).toBe("buy");
    expect(decision.confidence).toBe(0.82);
  });

  it("blocks when OpenAI returns invalid or refusal-like text", async () => {
    const service = new AIReasoningService({
      env: testEnv(),
      responsesCreate: async () => ({ output_text: "I cannot comply." })
    });

    const result = await service.reason(baseContext());

    expect(result.decision).toBe("block");
    expect(result.configured).toBe(false);
    expect(result.riskFlags).toContain("ai_unavailable");
  });

  it("sends gpt-5.5 Responses API settings with store disabled", async () => {
    let capturedRequest: Record<string, unknown> | undefined;
    const service = new AIReasoningService({
      env: testEnv({ OPENAI_STORE_RESPONSES: false }),
      responsesCreate: async (request) => {
        capturedRequest = request as Record<string, unknown>;
        return {
          id: "resp_test",
          output_text: JSON.stringify({
            decision: "buy",
            confidence: 0.78,
            rationale: "Aligned with deterministic RSI signal.",
            riskFlags: [],
            learningUpdate: {
              summary: "Valid paper buy setup.",
              rewardSignal: 0.1,
              observations: [],
              mistakesToAvoid: []
            },
            recommendedParameterAdjustments: {
              rsiPeriod: 2,
              oversoldThreshold: 30,
              overboughtThreshold: 70,
              maxNotionalMultiplier: 1
            }
          })
        };
      }
    });

    const result = await service.reason(baseContext());

    expect(result.decision).toBe("buy");
    expect(capturedRequest?.model).toBe("gpt-5.5");
    expect(capturedRequest?.store).toBe(false);
    expect(capturedRequest).not.toHaveProperty("OPENAI_API_KEY");
  });
});

function baseContext(): TradingContext {
  return {
    symbol: "AAPL",
    generatedAt: new Date().toISOString(),
    currentPrice: 100,
    barSummary: {
      timeframe: "5Min",
      count: 10,
      firstClose: 101,
      lastClose: 100,
      high: 105,
      low: 98,
      volume: 10000
    },
    rsi: {
      period: 2,
      current: 22,
      previous: 24,
      oversoldThreshold: 30,
      overboughtThreshold: 70
    },
    deterministicSignal: {
      symbol: "AAPL",
      action: "buy",
      rsi: 22,
      previousRsi: 24,
      confidence: 0.7,
      reason: "RSI is oversold.",
      recommendedNotional: 10
    },
    account: {
      buyingPower: 1000,
      cash: 1000,
      portfolioValue: 1000
    },
    openPositionsCount: 0,
    recentTrades: [],
    realizedPnlToday: 0,
    riskLimits: {
      maxNotionalPerOrder: 10,
      maxPositionNotionalPerSymbol: 25,
      maxDailyLossUsd: 5,
      maxOpenPositions: 3,
      minAiConfidence: 0.55
    },
    priorLessons: [],
    researchBriefs: []
  };
}
