import { prisma } from "@/lib/db/prisma";
import {
  getDefaultEmergingSettings,
  getEmergingSettings,
  normalizeEmergingSettings,
  normalizeEmergingSymbol,
  setEmergingSettings
} from "@/lib/emerging/settings";
import { getDefaultTradeSizingSettings, getTradeSizingSettings } from "@/lib/trading/tradeSizing";
import type {
  EmergingResearchSettings,
  EmergingSettingsRecommendation,
  TradeSizingSettings
} from "@/lib/types/trading";

const RESEARCH_ITEM_LIMIT = 200;
const OPPORTUNITY_LIMIT = 100;

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

export type EmergingRecommendationSignal = {
  symbol: string;
  text: string;
  confidence?: number;
  score?: number;
};

type RankedEmergingSignal = {
  symbol: string;
  score: number;
};

export async function recommendEmergingSettings(options?: {
  save?: boolean;
  now?: Date;
}): Promise<EmergingSettingsRecommendation> {
  const now = options?.now ?? new Date();
  const [currentSettings, tradeSizing, researchItems, opportunities] = await Promise.all([
    getEmergingSettings().catch(() => getDefaultEmergingSettings()),
    getTradeSizingSettings().catch(() => getDefaultTradeSizingSettings()),
    prisma.researchItem.findMany({
      orderBy: { publishedAt: "desc" },
      take: RESEARCH_ITEM_LIMIT
    }),
    prisma.opportunity.findMany({
      where: {
        status: "active",
        expiresAt: { gt: now }
      },
      orderBy: { score: "desc" },
      take: OPPORTUNITY_LIMIT
    })
  ]);

  const signals: EmergingRecommendationSignal[] = [
    ...researchItems.map((item) => ({
      symbol: item.symbol,
      text: [item.headline, item.summary, item.catalyst].filter(Boolean).join(" "),
      confidence: item.confidence
    })),
    ...opportunities.map((opportunity) => ({
      symbol: opportunity.symbol,
      text: [opportunity.thesis, opportunity.catalyst].filter(Boolean).join(" "),
      confidence: opportunity.confidence,
      score: opportunity.score
    }))
  ];

  const recommendation = buildRecommendedEmergingSettings({
    currentSettings,
    tradeSizing,
    signals,
    sourceCounts: {
      researchItems: researchItems.length,
      opportunities: opportunities.length
    }
  });

  if (!options?.save) return recommendation;

  const savedSettings = await setEmergingSettings(recommendation.settings);
  return {
    ...recommendation,
    settings: savedSettings
  };
}

export function buildRecommendedEmergingSettings(params: {
  currentSettings?: EmergingResearchSettings;
  tradeSizing?: TradeSizingSettings;
  signals?: EmergingRecommendationSignal[];
  sourceCounts?: {
    researchItems: number;
    opportunities: number;
  };
}): EmergingSettingsRecommendation {
  const currentSettings = params.currentSettings ?? getDefaultEmergingSettings();
  const tradeSizing = params.tradeSizing ?? getDefaultTradeSizingSettings();
  const rankedSignals = rankEmergingSignals(params.signals ?? []);
  const matchedSymbols = rankedSignals.map((signal) => signal.symbol);
  const seedSymbols = uniqueSymbols([...currentSettings.seedSymbols, ...matchedSymbols]);
  const maxSymbols = Math.min(20, Math.max(12, Math.min(20, seedSymbols.length || currentSettings.maxSymbols)));
  const maxBidNotional = Math.max(1, Math.min(10, tradeSizing.maxBidNotional));
  const maxPositionNotionalPerSymbol = Math.max(
    maxBidNotional,
    Math.min(50, tradeSizing.maxPositionNotionalPerSymbol, maxBidNotional * 5)
  );
  const enoughMatches = rankedSignals.length >= maxSymbols;

  const settings = normalizeEmergingSettings(
    {
      ...currentSettings,
      enabled: true,
      seedSymbols: seedSymbols.slice(0, maxSymbols),
      maxSymbols,
      newsLookbackHours: rankedSignals.length > 0 ? 72 : 168,
      newsLimit: enoughMatches ? 30 : 50,
      minOpportunityConfidence: enoughMatches ? 0.45 : rankedSignals.length > 0 ? 0.4 : 0.35,
      minPrice: 1,
      maxPrice: 75,
      minAvgDailyVolume: 100_000,
      maxMarketCapUsd: 20_000_000_000,
      maxIpoAgeDays: 730,
      maxBidNotional,
      maxPositionNotionalPerSymbol
    },
    currentSettings
  );

  const reasons = [
    rankedSignals.length > 0
      ? `Seeded ${settings.seedSymbols.length} symbol(s) from recent IPO/emerging-tech research matches.`
      : "No stored IPO/emerging-tech matches found yet, so discovery uses a wider seven-day news window.",
    enoughMatches
      ? "Raised the confidence threshold and lowered the news limit because stored research already has enough candidate signals."
      : "Kept discovery broad enough to find new candidates while still capping the news request.",
    `Set paper exposure conservatively at $${settings.maxBidNotional.toFixed(2)} max bid and $${settings.maxPositionNotionalPerSymbol.toFixed(2)} max holding for this lane.`
  ];

  return {
    settings,
    reasons,
    matchedSymbols,
    sourceCounts: {
      researchItems: params.sourceCounts?.researchItems ?? 0,
      opportunities: params.sourceCounts?.opportunities ?? 0,
      matchedSignals: rankedSignals.length
    }
  };
}

function rankEmergingSignals(signals: EmergingRecommendationSignal[]): RankedEmergingSignal[] {
  const bySymbol = new Map<string, RankedEmergingSignal>();

  for (const signal of signals) {
    const symbol = normalizeEmergingSymbol(signal.symbol);
    if (!symbol) continue;

    const text = signal.text.toLowerCase();
    const ipoMatches = countMatches(text, IPO_TERMS);
    const techMatches = countMatches(text, TECH_TERMS);
    const riskMatches = countMatches(text, RISK_TERMS);
    if (ipoMatches + techMatches === 0) continue;

    const confidence = clamp(signal.confidence ?? 0.35, 0, 1);
    const sourceScore = clamp(signal.score ?? 0, -1, 1);
    const score = clamp(
      confidence * 0.35 + Math.max(0, sourceScore) * 0.25 + ipoMatches * 0.3 + techMatches * 0.12 - riskMatches * 0.18,
      0,
      1
    );
    const existing = bySymbol.get(symbol);
    if (!existing || score > existing.score) {
      bySymbol.set(symbol, { symbol, score });
    }
  }

  return [...bySymbol.values()].sort((left, right) => {
    const scoreDiff = right.score - left.score;
    if (scoreDiff !== 0) return scoreDiff;
    return left.symbol.localeCompare(right.symbol);
  });
}

function uniqueSymbols(symbols: string[]): string[] {
  return [
    ...new Set(
      symbols.map((symbol) => normalizeEmergingSymbol(symbol)).filter((symbol): symbol is string => Boolean(symbol))
    )
  ];
}

function countMatches(text: string, terms: string[]): number {
  return terms.filter((term) => termMatches(text, term)).length;
}

function termMatches(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = /^[a-z0-9]+$/i.test(term) ? new RegExp(`\\b${escaped}\\b`, "i") : new RegExp(escaped, "i");
  return pattern.test(text);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
