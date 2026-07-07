import { AlpacaNewsClient, newsContentHash } from "@/lib/research/alpacaNews";
import { analyzeNewsArticle } from "@/lib/research/scoring";
import { getBotRuntimeConfig, getResearchRuntimeConfig } from "@/lib/config/env";
import { getFocusedSymbols } from "@/lib/db/focusSymbols";
import { prisma } from "@/lib/db/prisma";
import type { NewsArticle, ResearchAnalysis, ResearchCrawlResult } from "@/lib/types/trading";

export async function runResearchCrawl(options?: {
  client?: AlpacaNewsClient;
  symbols?: string[];
  lookbackHours?: number;
  limit?: number;
  opportunityTtlHours?: number;
  minConfidence?: number;
  focusedSymbols?: string[];
}): Promise<ResearchCrawlResult> {
  const startedAt = new Date();
  const botConfig = getBotRuntimeConfig();
  const researchConfig = getResearchRuntimeConfig(undefined, botConfig.watchlist);
  const baseSymbols = options?.symbols ?? researchConfig.symbols;
  const focusedSymbols =
    options?.focusedSymbols ?? (options?.symbols ? [] : await getFocusedSymbols().catch(() => []));
  const symbols = uniqueStrings(
    [...baseSymbols, ...focusedSymbols]
      .map((symbol) => normalizeSymbol(symbol))
      .filter((symbol): symbol is string => Boolean(symbol))
  ).slice(0, researchConfig.maxSymbols);
  const lookbackHours = options?.lookbackHours ?? researchConfig.lookbackHours;
  const limit = options?.limit ?? researchConfig.newsLimit;
  const opportunityTtlHours = options?.opportunityTtlHours ?? researchConfig.opportunityTtlHours;
  const minConfidence = options?.minConfidence ?? researchConfig.minConfidence;
  const client = options?.client ?? new AlpacaNewsClient();

  await expireOldOpportunities();

  if (symbols.length === 0) {
    return {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      source: "alpaca_news",
      scannedArticles: 0,
      storedItems: 0,
      updatedItems: 0,
      opportunitiesCreated: 0,
      opportunitiesUpdated: 0,
      symbols
    };
  }

  const articles = await client.getNews({
    symbols,
    start: new Date(Date.now() - lookbackHours * 60 * 60 * 1000),
    limit,
    includeContent: false
  });

  let storedItems = 0;
  let updatedItems = 0;
  let opportunitiesCreated = 0;
  let opportunitiesUpdated = 0;

  for (const article of articles) {
    const articleSymbols = getArticleSymbols(article, symbols);
    for (const symbol of articleSymbols) {
      const analysis = analyzeNewsArticle({
        article,
        symbol,
        ttlHours: opportunityTtlHours
      });
      const itemResult = await storeResearchItem({ article, symbol, analysis });
      storedItems += itemResult.created ? 1 : 0;
      updatedItems += itemResult.created ? 0 : 1;

      if (analysis.confidence >= minConfidence) {
        const opportunityResult = await upsertOpportunity({
          symbol,
          itemId: itemResult.id,
          analysis
        });
        opportunitiesCreated += opportunityResult.created ? 1 : 0;
        opportunitiesUpdated += opportunityResult.created ? 0 : 1;
      }
    }
  }

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    source: "alpaca_news",
    scannedArticles: articles.length,
    storedItems,
    updatedItems,
    opportunitiesCreated,
    opportunitiesUpdated,
    symbols
  };
}

async function storeResearchItem(params: {
  article: NewsArticle;
  symbol: string;
  analysis: ResearchAnalysis;
}): Promise<{ id: string; created: boolean }> {
  const externalId = `${params.article.id}:${params.symbol}`;
  const publishedAt = parseDate(params.article.createdAt) ?? new Date();
  const existing = await prisma.researchItem.findUnique({ where: { externalId } });
  const data = {
    symbol: params.symbol,
    source: params.article.source,
    sourceUrl: params.article.url,
    headline: params.article.headline,
    summary: params.article.summary,
    contentHash: newsContentHash(params.article),
    allSymbolsJson: JSON.stringify(params.article.symbols),
    sentiment: params.analysis.sentiment,
    catalyst: params.analysis.catalyst,
    riskFlagsJson: JSON.stringify(params.analysis.riskFlags),
    confidence: params.analysis.confidence,
    publishedAt,
    expiresAt: new Date(params.analysis.expiresAt)
  };

  if (existing) {
    const updated = await prisma.researchItem.update({
      where: { externalId },
      data
    });
    return { id: updated.id, created: false };
  }

  const created = await prisma.researchItem.create({
    data: {
      externalId,
      ...data
    }
  });
  return { id: created.id, created: true };
}

async function upsertOpportunity(params: {
  symbol: string;
  itemId: string;
  analysis: ResearchAnalysis;
}): Promise<{ created: boolean }> {
  const active = await prisma.opportunity.findFirst({
    where: {
      symbol: params.symbol,
      direction: params.analysis.sentiment,
      status: "active",
      expiresAt: { gt: new Date() }
    },
    orderBy: { lastSeenAt: "desc" }
  });

  if (!active) {
    await prisma.opportunity.create({
      data: {
        symbol: params.symbol,
        direction: params.analysis.sentiment,
        thesis: params.analysis.thesis,
        catalyst: params.analysis.catalyst,
        confidence: params.analysis.confidence,
        score: params.analysis.score,
        sourceItemIdsJson: JSON.stringify([params.itemId]),
        riskFlagsJson: JSON.stringify(params.analysis.riskFlags),
        expiresAt: new Date(params.analysis.expiresAt)
      }
    });
    return { created: true };
  }

  const sourceItemIds = uniqueStrings([...parseJsonArray(active.sourceItemIdsJson), params.itemId]);
  await prisma.opportunity.update({
    where: { id: active.id },
    data: {
      thesis: params.analysis.confidence >= active.confidence ? params.analysis.thesis : active.thesis,
      catalyst: params.analysis.confidence >= active.confidence ? params.analysis.catalyst : active.catalyst,
      confidence: Math.max(active.confidence, params.analysis.confidence),
      score: Math.abs(params.analysis.score) > Math.abs(active.score) ? params.analysis.score : active.score,
      sourceItemIdsJson: JSON.stringify(sourceItemIds),
      riskFlagsJson: JSON.stringify(uniqueStrings([...parseJsonArray(active.riskFlagsJson), ...params.analysis.riskFlags])),
      expiresAt: new Date(params.analysis.expiresAt)
    }
  });
  return { created: false };
}

async function expireOldOpportunities(): Promise<void> {
  await prisma.opportunity.updateMany({
    where: {
      status: "active",
      expiresAt: { lte: new Date() }
    },
    data: { status: "expired" }
  });
}

function getArticleSymbols(article: NewsArticle, requestedSymbols: string[]): string[] {
  const symbols = article.symbols.length > 0 ? article.symbols : requestedSymbols;
  return uniqueStrings(symbols.map((symbol) => symbol.toUpperCase())).filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeSymbol(symbol: string): string | undefined {
  const normalized = symbol.trim().toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(normalized) ? normalized : undefined;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function parseDate(value: string): Date | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
