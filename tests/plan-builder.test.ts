import { describe, expect, it } from "vitest";
import { buildTradePlan, type PlanOpportunityInput } from "@/lib/plan/builder";
import { testConfig } from "@/tests/helpers";

describe("trade plan builder", () => {
  it("ranks active opportunities and marks RSI eligibility without placing trades", async () => {
    const opportunities: PlanOpportunityInput[] = [
      {
        id: "opp-aapl",
        symbol: "AAPL",
        direction: "bullish",
        thesis: "AAPL has potentially positive news from a product launch.",
        catalyst: "launch",
        confidence: 0.72,
        score: 0.72,
        riskFlags: [],
        expiresAt: new Date(Date.UTC(2026, 0, 2)),
        sourceUrls: ["https://example.com/aapl"],
        sourceHeadlines: ["Apple announces a product launch"]
      },
      {
        id: "opp-tsla",
        symbol: "TSLA",
        direction: "bullish",
        thesis: "TSLA has potentially positive news from an upgrade.",
        catalyst: "upgrade",
        confidence: 0.9,
        score: 0.9,
        riskFlags: [],
        expiresAt: new Date(Date.UTC(2026, 0, 2)),
        sourceUrls: ["https://example.com/tsla"],
        sourceHeadlines: ["Analyst upgrades Tesla"]
      }
    ];

    const plan = await buildTradePlan({
      config: testConfig(),
      now: new Date(Date.UTC(2026, 0, 1)),
      opportunities,
      positions: [],
      learningEvents: [
        {
          symbol: "AAPL",
          reward: 0.1,
          summary: "Prior AAPL paper setup respected the position cap."
        }
      ],
      persist: false
    });

    expect(plan.status).toBe("preview");
    expect(plan.inputSummary.advisoryOnly).toBe(true);
    expect(plan.items).toHaveLength(2);
    expect(plan.items[0]?.symbol).toBe("TSLA");
    expect(plan.items[0]?.eligibleForRsi).toBe(false);
    expect(plan.items[0]?.tradableNow).toBe(false);

    const aapl = plan.items.find((item) => item.symbol === "AAPL");
    expect(aapl?.suggestedAction).toBe("buy_candidate");
    expect(aapl?.eligibleForRsi).toBe(true);
    expect(aapl?.tradableNow).toBe(true);
    expect(aapl?.tradabilityReason).toContain("deterministic RSI");
  });

  it("turns negative research on an existing position into a sell candidate", async () => {
    const plan = await buildTradePlan({
      config: testConfig(),
      opportunities: [
        {
          id: "opp-aapl-risk",
          symbol: "AAPL",
          direction: "bearish",
          thesis: "AAPL has potentially negative news to treat as a risk.",
          catalyst: "downgrade",
          confidence: 0.7,
          score: -0.7,
          riskFlags: ["News mentions downgrade."],
          expiresAt: new Date(Date.UTC(2026, 0, 2))
        }
      ],
      positions: [
        {
          symbol: "AAPL",
          qty: 0.1,
          marketValue: 20,
          avgEntryPrice: 200,
          unrealizedPnl: -1
        }
      ],
      learningEvents: [],
      persist: false
    });

    expect(plan.items[0]?.suggestedAction).toBe("sell_candidate");
    expect(plan.items[0]?.tradableNow).toBe(true);
    expect(plan.items[0]?.riskNotes.join(" ")).toContain("downgrade");
  });

  it("includes focused symbols as watch items when no active catalyst exists", async () => {
    const plan = await buildTradePlan({
      config: testConfig(),
      opportunities: [],
      positions: [],
      learningEvents: [],
      focusedSymbols: ["NVDA"],
      persist: false
    });

    expect(plan.inputSummary.focusedSymbolCount).toBe(1);
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]?.symbol).toBe("NVDA");
    expect(plan.items[0]?.suggestedAction).toBe("watch");
    expect(plan.items[0]?.riskNotes.join(" ")).toContain("Focused research symbol");
  });
});
