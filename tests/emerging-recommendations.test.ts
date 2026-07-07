import { describe, expect, it } from "vitest";
import { buildRecommendedEmergingSettings } from "@/lib/emerging/recommendations";
import { getDefaultEmergingSettings } from "@/lib/emerging/settings";

describe("emerging recommendations", () => {
  it("recommends conservative settings from emerging-tech research signals", () => {
    const recommendation = buildRecommendedEmergingSettings({
      currentSettings: {
        ...getDefaultEmergingSettings(),
        seedSymbols: ["RKLB"]
      },
      tradeSizing: {
        minBidNotional: 10,
        maxBidNotional: 100,
        maxPositionNotionalPerSymbol: 1000
      },
      signals: [
        {
          symbol: "IONQ",
          text: "AI startup begins trading after public debut",
          confidence: 0.8,
          score: 0.7
        },
        {
          symbol: "MEGA",
          text: "Established retailer announces quarterly dividend",
          confidence: 0.9,
          score: 0.8
        }
      ],
      sourceCounts: {
        researchItems: 2,
        opportunities: 1
      }
    });

    expect(recommendation.settings.enabled).toBe(true);
    expect(recommendation.settings.seedSymbols).toEqual(["IONQ", "RKLB"]);
    expect(recommendation.settings.newsLookbackHours).toBe(72);
    expect(recommendation.settings.maxBidNotional).toBe(10);
    expect(recommendation.settings.maxPositionNotionalPerSymbol).toBe(50);
    expect(recommendation.matchedSymbols).toEqual(["IONQ"]);
    expect(recommendation.sourceCounts).toEqual({
      researchItems: 2,
      opportunities: 1,
      matchedSignals: 1
    });
  });

  it("uses a wider discovery window when stored research has no emerging matches", () => {
    const recommendation = buildRecommendedEmergingSettings({
      signals: [
        {
          symbol: "AAPL",
          text: "Established large-cap product update",
          confidence: 0.8
        }
      ]
    });

    expect(recommendation.settings.seedSymbols).toEqual([]);
    expect(recommendation.settings.newsLookbackHours).toBe(168);
    expect(recommendation.settings.minOpportunityConfidence).toBe(0.35);
  });
});
