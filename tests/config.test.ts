import { describe, expect, it } from "vitest";
import { getBotRuntimeConfig, getResearchRuntimeConfig } from "@/lib/config/env";
import { testEnv } from "@/tests/helpers";

describe("runtime config", () => {
  it("caps research symbols and discards invalid wildcard values", () => {
    const env = testEnv({
      WATCHLIST: "AAPL,MSFT,NVDA,TSLA,AMZN,META,GOOGL,SPY",
      RESEARCH_SYMBOLS: "*, AAPL, MSFT, NVDA, TSLA",
      RESEARCH_MAX_SYMBOLS: 3
    });

    const researchConfig = getResearchRuntimeConfig(env, getBotRuntimeConfig(env).watchlist);

    expect(researchConfig.symbols).toEqual(["AAPL", "MSFT", "NVDA"]);
    expect(researchConfig.maxSymbols).toBe(3);
  });
});
