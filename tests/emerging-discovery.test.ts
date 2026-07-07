import { describe, expect, it } from "vitest";
import { buildEmergingDiscoveryCandidates } from "@/lib/emerging/discovery";
import type { NewsArticle, StockAsset } from "@/lib/types/trading";

const asset: StockAsset = {
  symbol: "RKLB",
  name: "Rocket Lab USA Inc.",
  exchange: "NASDAQ",
  tradable: true,
  fractionable: true
};

describe("emerging discovery", () => {
  it("finds tradable IPO and emerging-tech candidates from news", () => {
    const candidates = buildEmergingDiscoveryCandidates({
      assets: [asset],
      articles: [
        {
          id: "news-1",
          source: "alpaca_news",
          url: "https://example.com/rklb",
          headline: "Venture-backed space startup begins trading after public debut",
          symbols: ["RKLB"],
          createdAt: new Date(Date.UTC(2026, 0, 1)).toISOString()
        },
        {
          id: "news-2",
          source: "alpaca_news",
          url: "https://example.com/private",
          headline: "Private startup raises venture funding",
          symbols: ["PRIVATE"],
          createdAt: new Date(Date.UTC(2026, 0, 1)).toISOString()
        }
      ] satisfies NewsArticle[]
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.symbol).toBe("RKLB");
    expect(candidates[0]?.reasons.join(" ")).toContain("public debut");
  });
});
