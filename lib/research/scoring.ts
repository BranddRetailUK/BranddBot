import type { NewsArticle, ResearchAnalysis } from "@/lib/types/trading";

const BULLISH_TERMS = [
  "approval",
  "award",
  "beat",
  "buyback",
  "contract",
  "dividend",
  "growth",
  "guidance raised",
  "launch",
  "partnership",
  "profit",
  "record",
  "upgrade"
];

const BEARISH_TERMS = [
  "bankruptcy",
  "cut guidance",
  "downgrade",
  "investigation",
  "lawsuit",
  "loss",
  "miss",
  "probe",
  "recall",
  "restructuring",
  "sec charges",
  "warning"
];

export function analyzeNewsArticle(params: {
  article: NewsArticle;
  symbol: string;
  ttlHours: number;
}): ResearchAnalysis {
  const text = [params.article.headline, params.article.summary ?? "", params.article.content ?? ""]
    .join(" ")
    .toLowerCase();
  const bullishMatches = findMatches(text, BULLISH_TERMS);
  const bearishMatches = findMatches(text, BEARISH_TERMS);
  const hasSummary = Boolean(params.article.summary?.trim());

  const direction = chooseDirection(bullishMatches.length, bearishMatches.length);
  const catalyst = chooseCatalyst(direction, bullishMatches, bearishMatches);
  const riskFlags = bearishMatches.map((term) => `News mentions ${term}.`);
  const signalCount = bullishMatches.length + bearishMatches.length;
  const confidence = clamp(0.18 + signalCount * 0.16 + (hasSummary ? 0.12 : 0), 0.15, 0.9);
  const directionalScore = direction === "bullish" ? 1 : direction === "bearish" ? -1 : 0.2;
  const score = Number((confidence * directionalScore).toFixed(4));
  const expiresAt = new Date(Date.now() + params.ttlHours * 60 * 60 * 1000).toISOString();

  return {
    sentiment: direction,
    catalyst,
    thesis: buildThesis({
      symbol: params.symbol,
      direction,
      headline: params.article.headline,
      catalyst
    }),
    confidence,
    score,
    riskFlags,
    expiresAt
  };
}

function findMatches(text: string, terms: string[]): string[] {
  return terms.filter((term) => text.includes(term));
}

function chooseDirection(bullishCount: number, bearishCount: number): ResearchAnalysis["sentiment"] {
  if (bullishCount > bearishCount) return "bullish";
  if (bearishCount > bullishCount) return "bearish";
  return "watch";
}

function chooseCatalyst(direction: ResearchAnalysis["sentiment"], bullish: string[], bearish: string[]): string {
  if (direction === "bullish" && bullish.length > 0) return bullish.slice(0, 3).join(", ");
  if (direction === "bearish" && bearish.length > 0) return bearish.slice(0, 3).join(", ");
  if (bullish.length > 0 || bearish.length > 0) return [...bullish, ...bearish].slice(0, 3).join(", ");
  return "Fresh market news";
}

function buildThesis(params: {
  symbol: string;
  direction: ResearchAnalysis["sentiment"];
  headline: string;
  catalyst: string;
}): string {
  if (params.direction === "bullish") {
    return `${params.symbol} has potentially positive news: ${params.headline}`;
  }
  if (params.direction === "bearish") {
    return `${params.symbol} has potentially negative news to treat as a risk: ${params.headline}`;
  }
  return `${params.symbol} has fresh news to monitor: ${params.headline}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
