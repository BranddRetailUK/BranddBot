import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(async () => ({ count: 0 }))
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    opportunity: {
      updateMany: mocks.updateMany
    }
  }
}));

describe("research crawl", () => {
  it("does not request unscoped Alpaca news when no symbols are configured", async () => {
    const { runResearchCrawl } = await import("@/lib/research/crawl");
    const client = {
      getNews: vi.fn(async () => [])
    };

    const result = await runResearchCrawl({
      client: client as never,
      symbols: [],
      focusedSymbols: []
    });

    expect(client.getNews).not.toHaveBeenCalled();
    expect(result.scannedArticles).toBe(0);
    expect(result.symbols).toEqual([]);
  });
});
