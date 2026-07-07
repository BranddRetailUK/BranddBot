import { describe, expect, it } from "vitest";
import { normalizeEmergingSettings } from "@/lib/emerging/settings";

describe("emerging settings", () => {
  it("normalizes symbols and keeps holding cap above max bid", () => {
    const settings = normalizeEmergingSettings({
      seedSymbols: ["rklb", " RKLB ", "bad symbol", "ionq"],
      maxSymbols: 8,
      minPrice: 10,
      maxPrice: 5,
      maxBidNotional: 100,
      maxPositionNotionalPerSymbol: 25
    });

    expect(settings.seedSymbols).toEqual(["IONQ", "RKLB"]);
    expect(settings.maxPrice).toBe(10);
    expect(settings.maxPositionNotionalPerSymbol).toBe(100);
  });
});
