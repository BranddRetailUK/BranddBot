import { AlpacaNewsClient } from "@/lib/research/alpacaNews";
import { getStockAssets } from "@/lib/market/assets";
import { addEmergingSymbols, getEmergingSettings } from "@/lib/emerging/settings";
import type { EmergingDiscoveryCandidate, EmergingResearchSettings, NewsArticle, StockAsset } from "@/lib/types/trading";

const IPO_TERMS = [
  "ipo",
  "initial public offering",
  "market debut",
  "public debut",
  "direct listing",
  "spac",
  "de-spac",
  "files to go public",
  "prices shares",
  "begins trading"
];

const TECH_TERMS = [
  "ai",
  "artificial intelligence",
  "automation",
  "cloud",
  "cybersecurity",
  "data center",
  "robotics",
  "semiconductor",
  "software",
  "space",
  "startup",
  "venture-backed"
];

const RISK_TERMS = ["bankruptcy", "delisting", "investigation", "lawsuit", "sec charges", "warning"];

export type EmergingDiscoveryResult = {
  startedAt: string;
  finishedAt: string;
  scannedArticles: number;
  candidates: EmergingDiscoveryCandidate[];
  addedSymbols: string[];
  settings: EmergingResearchSettings;
};

export async function runEmergingDiscovery(options?: {
  settings?: EmergingResearchSettings;
  client?: AlpacaNewsClient;
  now?: Date;
  saveSymbols?: boolean;
}): Promise<EmergingDiscoveryResult> {
  const startedAt = options?.now ?? new Date();
  const now = options?.now ?? startedAt;
  const settings = options?.settings ?? (await getEmergingSettings());
  const client = options?.client ?? new AlpacaNewsClient();
  const assets = await getStockAssets();
  const assetBySymbol = new Map(assets.map((asset) => [asset.symbol, asset]));

  if (!settings.enabled) {
    return buildResult({ startedAt, now, settings, articles: [], candidates: [], addedSymbols: [] });
  }

  const articles = await client.getNews({
    start: new Date(now.getTime() - settings.newsLookbackHours * 60 * 60 * 1000),
    limit: settings.newsLimit,
    includeContent: false
  });
  const candidates = buildCandidates({ articles, assetBySymbol, settings });
  const addedSymbols = options?.saveSymbols ? candidates.map((candidate) => candidate.symbol) : [];

  if (addedSymbols.length > 0) {
    await addEmergingSymbols(addedSymbols);
  }

  return buildResult({ startedAt, now: new Date(), settings, articles, candidates, addedSymbols });
}

export function buildEmergingDiscoveryCandidates(params: {
  articles: NewsArticle[];
  assets?: StockAsset[];
  settings?: EmergingResearchSettings;
}): EmergingDiscoveryCandidate[] {
  const fallback = getFallbackSettingsForPureBuild();
  return buildCandidates({
    articles: params.articles,
    assetBySymbol: new Map((params.assets ?? []).map((asset) => [asset.symbol, asset])),
    settings: params.settings ?? fallback
  });
}

function buildCandidates(params: {
  articles: NewsArticle[];
  assetBySymbol: Map<string, StockAsset>;
  settings: EmergingResearchSettings;
}): EmergingDiscoveryCandidate[] {
  const bySymbol = new Map<string, EmergingDiscoveryCandidate>();

  for (const article of params.articles) {
    const score = scoreArticle(article);
    if (score.score < params.settings.minOpportunityConfidence) continue;

    for (const symbol of article.symbols.map((item) => item.toUpperCase())) {
      const asset = params.assetBySymbol.get(symbol);
      if (params.assetBySymbol.size > 0 && !asset) continue;
      if (asset && (!asset.tradable || !asset.fractionable)) continue;

      const candidate: EmergingDiscoveryCandidate = {
        symbol,
        companyName: asset?.name,
        source: article.source,
        headline: article.headline,
        sourceUrl: article.url,
        score: score.score,
        reasons: score.reasons,
        publishedAt: article.createdAt,
        tradable: asset?.tradable ?? false,
        fractionable: asset?.fractionable ?? false
      };
      const existing = bySymbol.get(symbol);
      if (!existing || candidate.score > existing.score || candidate.publishedAt > existing.publishedAt) {
        bySymbol.set(symbol, candidate);
      }
    }
  }

  return [...bySymbol.values()]
    .sort((left, right) => {
      const scoreDiff = right.score - left.score;
      if (scoreDiff !== 0) return scoreDiff;
      return right.publishedAt.localeCompare(left.publishedAt);
    })
    .slice(0, params.settings.maxSymbols);
}

function scoreArticle(article: NewsArticle): { score: number; reasons: string[] } {
  const text = [article.headline, article.summary ?? "", article.content ?? ""].join(" ").toLowerCase();
  const ipoMatches = findMatches(text, IPO_TERMS);
  const techMatches = findMatches(text, TECH_TERMS);
  const riskMatches = findMatches(text, RISK_TERMS);
  const score = clamp(0.12 + ipoMatches.length * 0.28 + techMatches.length * 0.12 - riskMatches.length * 0.18, 0, 1);
  const reasons = [
    ...ipoMatches.slice(0, 3).map((term) => `IPO signal: ${term}`),
    ...techMatches.slice(0, 3).map((term) => `Tech signal: ${term}`),
    ...riskMatches.slice(0, 2).map((term) => `Risk mention: ${term}`)
  ];

  return {
    score: Number(score.toFixed(4)),
    reasons: reasons.length > 0 ? reasons : ["Recent market news matched emerging-stock discovery."]
  };
}

function findMatches(text: string, terms: string[]): string[] {
  return terms.filter((term) => text.includes(term));
}

function buildResult(params: {
  startedAt: Date;
  now: Date;
  settings: EmergingResearchSettings;
  articles: NewsArticle[];
  candidates: EmergingDiscoveryCandidate[];
  addedSymbols: string[];
}): EmergingDiscoveryResult {
  return {
    startedAt: params.startedAt.toISOString(),
    finishedAt: params.now.toISOString(),
    scannedArticles: params.articles.length,
    candidates: params.candidates,
    addedSymbols: params.addedSymbols,
    settings: params.settings
  };
}

function getFallbackSettingsForPureBuild(): EmergingResearchSettings {
  return {
    enabled: true,
    seedSymbols: [],
    maxSymbols: 12,
    newsLookbackHours: 168,
    newsLimit: 50,
    minOpportunityConfidence: 0.35,
    minPrice: 1,
    maxPrice: 75,
    minAvgDailyVolume: 100_000,
    maxMarketCapUsd: 20_000_000_000,
    maxIpoAgeDays: 730,
    maxBidNotional: 10,
    maxPositionNotionalPerSymbol: 50
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
