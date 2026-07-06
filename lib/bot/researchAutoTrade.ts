import { AlpacaBroker } from "@/lib/broker/alpaca";
import type { BrokerAdapter } from "@/lib/broker/types";
import { getBotRuntimeConfig, getResearchAutoTradeRuntimeConfig } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import {
  applyTradeSizingToBotConfig,
  applyTradeSizingToResearchAutoTradeConfig,
  getTradeSizingSettings
} from "@/lib/trading/tradeSizing";
import type {
  AccountSnapshot,
  BotRuntimeConfig,
  OrderRequest,
  OrderSide,
  PositionSnapshot,
  ResearchAutoTradeConfig,
  ResearchAutoTradeItemResult,
  ResearchAutoTradeResult,
  TradeSizingSettings
} from "@/lib/types/trading";

export type ResearchAutoTradeOpportunityInput = {
  id: string;
  symbol: string;
  direction: "bullish" | "bearish" | "watch";
  thesis: string;
  catalyst: string;
  confidence: number;
  score: number;
  riskFlags: string[];
  expiresAt: Date | string;
  sourceItemIds?: string[];
  sourceUrls?: string[];
};

export type ResearchAutoTradeRecentTradeInput = {
  symbol: string;
  side: OrderSide;
  createdAt: Date | string;
};

export async function runResearchAutoTrade(options?: {
  dryRun?: boolean;
  broker?: BrokerAdapter;
  config?: BotRuntimeConfig;
  researchConfig?: ResearchAutoTradeConfig;
  now?: Date;
  account?: AccountSnapshot;
  positions?: PositionSnapshot[];
  opportunities?: ResearchAutoTradeOpportunityInput[];
  recentResearchTrades?: ResearchAutoTradeRecentTradeInput[];
  dailyResearchTradeCount?: number;
  realizedPnlToday?: number;
  tradeSizing?: TradeSizingSettings;
  persist?: boolean;
}): Promise<ResearchAutoTradeResult> {
  const startedAt = options?.now ?? new Date();
  const now = options?.now ?? startedAt;
  const dryRun = options?.dryRun ?? false;
  const providedRuntimeConfig = Boolean(options?.config && options?.researchConfig);
  const tradeSizing = options?.tradeSizing ?? (providedRuntimeConfig ? undefined : await getTradeSizingSettings());
  const baseConfig = options?.config ?? getBotRuntimeConfig();
  const baseResearchConfig = options?.researchConfig ?? getResearchAutoTradeRuntimeConfig();
  const config = tradeSizing ? applyTradeSizingToBotConfig(baseConfig, tradeSizing) : baseConfig;
  const researchConfig = tradeSizing
    ? applyTradeSizingToResearchAutoTradeConfig(baseResearchConfig, tradeSizing)
    : baseResearchConfig;

  if (!researchConfig.enabled) {
    return buildResult({
      startedAt,
      now,
      dryRun,
      config,
      researchConfig,
      items: []
    });
  }

  if (config.tradingMode !== "paper" || config.liveTradingEnabled || !config.paperTradingEndpoint) {
    return buildResult({
      startedAt,
      now,
      dryRun,
      config,
      researchConfig,
      items: [
        {
          symbol: "*",
          action: "skip",
          accepted: false,
          reasons: ["Research auto-trading requires paper mode, live trading disabled, and an Alpaca paper endpoint."],
          confidence: 0,
          score: 0,
          thesis: "Paper-only safety is not satisfied.",
          catalyst: "paper_only_guard",
          opportunityIds: [],
          sourceUrls: []
        }
      ]
    });
  }

  const broker = options?.broker ?? new AlpacaBroker();
  const cooldownSince = new Date(now.getTime() - researchConfig.symbolCooldownMinutes * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const [account, positions, opportunities, recentResearchTrades, dailyResearchTradeCount, realizedPnlToday] =
    await Promise.all([
      options?.account ? Promise.resolve(options.account) : broker.getAccount(),
      options?.positions ? Promise.resolve(options.positions) : broker.getPositions(),
      options?.opportunities ? Promise.resolve(options.opportunities) : loadActiveOpportunities(now),
      options?.recentResearchTrades
        ? Promise.resolve(options.recentResearchTrades)
        : loadRecentResearchTrades(cooldownSince),
      options?.dailyResearchTradeCount !== undefined
        ? Promise.resolve(options.dailyResearchTradeCount)
        : countResearchTradesSince(todayStart),
      options?.realizedPnlToday !== undefined ? Promise.resolve(options.realizedPnlToday) : getRealizedPnlToday()
    ]);

  const queue = buildCandidateQueue({ opportunities, positions, researchConfig, now });
  const items: ResearchAutoTradeItemResult[] = [];
  const submittedSymbolsInRun = new Set<string>();
  let openPositionsCount = positions.filter(hasLongPosition).length;
  let acceptedActions = 0;
  let submittedOrders = 0;
  let dailyTradeCount = dailyResearchTradeCount;

  for (const candidate of queue) {
    if (acceptedActions >= researchConfig.maxItemsPerRun) break;

    const item = evaluateCandidate({
      candidate,
      config,
      researchConfig,
      account,
      positions,
      recentResearchTrades,
      cooldownSince,
      realizedPnlToday,
      openPositionsCount,
      dailyTradeCount,
      submittedSymbolsInRun
    });

    if (!item.accepted || !item.orderRequest) {
      items.push(item);
      continue;
    }

    if (dryRun) {
      item.reasons.push("Dry run: paper order was not submitted.");
      items.push(item);
      submittedSymbolsInRun.add(item.symbol);
      acceptedActions += 1;
      dailyTradeCount += 1;
      if (item.action === "buy" && !positions.some((position) => position.symbol === item.symbol && hasLongPosition(position))) {
        openPositionsCount += 1;
      }
      continue;
    }

    try {
      const order = await broker.submitOrder(item.orderRequest);
      item.order = order;
      item.reasons.push("Submitted Alpaca paper order from research auto-trade executor.");
      await recordSubmittedResearchOrder({
        order,
        orderRequest: item.orderRequest,
        item,
        persist: options?.persist ?? true
      });
      items.push(item);
      acceptedActions += 1;
      submittedOrders += 1;
      submittedSymbolsInRun.add(item.symbol);
      dailyTradeCount += 1;
      if (item.action === "buy" && !positions.some((position) => position.symbol === item.symbol && hasLongPosition(position))) {
        openPositionsCount += 1;
      }
    } catch (error) {
      items.push({
        ...item,
        accepted: false,
        reasons: [
          ...item.reasons,
          `Broker submission failed: ${error instanceof Error ? error.message : "unknown error"}`
        ],
        orderRequest: undefined
      });
    }
  }

  return buildResult({
    startedAt,
    now: new Date(),
    dryRun,
    config,
    researchConfig,
    items,
    submittedOrders
  });
}

function buildCandidateQueue(params: {
  opportunities: ResearchAutoTradeOpportunityInput[];
  positions: PositionSnapshot[];
  researchConfig: ResearchAutoTradeConfig;
  now: Date;
}) {
  const grouped = new Map<string, ResearchAutoTradeOpportunityInput[]>();

  for (const opportunity of params.opportunities) {
    const symbol = opportunity.symbol.toUpperCase();
    const expiresAt = parseDate(opportunity.expiresAt);
    if (!symbol || !expiresAt || expiresAt <= params.now) continue;
    if (opportunity.direction !== "bullish" && opportunity.direction !== "bearish") continue;
    if (opportunity.confidence < params.researchConfig.minConfidence) continue;
    if (Math.abs(opportunity.score) < params.researchConfig.minScore) continue;

    grouped.set(symbol, [...(grouped.get(symbol) ?? []), { ...opportunity, symbol }]);
  }

  const candidates: Array<{
    symbol: string;
    action: OrderSide;
    opportunity: ResearchAutoTradeOpportunityInput;
    position?: PositionSnapshot;
  }> = [];

  for (const [symbol, opportunities] of grouped) {
    const position = params.positions.find((item) => item.symbol === symbol && hasLongPosition(item));
    const bestBullish = selectBestOpportunity(opportunities.filter((opportunity) => opportunity.direction === "bullish"));
    const bestBearish = selectBestOpportunity(opportunities.filter((opportunity) => opportunity.direction === "bearish"));

    if (position && bestBearish && (!bestBullish || Math.abs(bestBearish.score) >= Math.abs(bestBullish.score))) {
      candidates.push({ symbol, action: "sell", opportunity: bestBearish, position });
      continue;
    }

    if (bestBullish) {
      candidates.push({ symbol, action: "buy", opportunity: bestBullish, position });
    }
  }

  return candidates.sort((left, right) => {
    const actionPriority = Number(right.action === "sell") - Number(left.action === "sell");
    if (actionPriority !== 0) return actionPriority;
    const scoreDiff = Math.abs(right.opportunity.score) - Math.abs(left.opportunity.score);
    if (scoreDiff !== 0) return scoreDiff;
    const confidenceDiff = right.opportunity.confidence - left.opportunity.confidence;
    if (confidenceDiff !== 0) return confidenceDiff;
    return left.symbol.localeCompare(right.symbol);
  });
}

function evaluateCandidate(params: {
  candidate: {
    symbol: string;
    action: OrderSide;
    opportunity: ResearchAutoTradeOpportunityInput;
    position?: PositionSnapshot;
  };
  config: BotRuntimeConfig;
  researchConfig: ResearchAutoTradeConfig;
  account: AccountSnapshot;
  positions: PositionSnapshot[];
  recentResearchTrades: ResearchAutoTradeRecentTradeInput[];
  cooldownSince: Date;
  realizedPnlToday: number;
  openPositionsCount: number;
  dailyTradeCount: number;
  submittedSymbolsInRun: Set<string>;
}): ResearchAutoTradeItemResult {
  const { candidate, config, researchConfig } = params;
  const reasons: string[] = [];
  const sourceUrls = candidate.opportunity.sourceUrls ?? [];
  const opportunityIds = [candidate.opportunity.id];
  let orderRequest: OrderRequest | undefined;

  if (params.realizedPnlToday <= -config.risk.maxDailyLossUsd) {
    reasons.push(`Daily loss limit reached: ${params.realizedPnlToday.toFixed(2)} USD.`);
  }

  if (params.dailyTradeCount >= researchConfig.maxDailyOrders) {
    reasons.push(`Research auto-trade daily order cap reached: ${researchConfig.maxDailyOrders}.`);
  }

  if (params.submittedSymbolsInRun.has(candidate.symbol)) {
    reasons.push("This symbol already has a research auto-trade action in the current run.");
  }

  if (candidate.action === "buy") {
    const currentExposure = candidate.position?.marketValue ?? 0;
    const remainingForSymbol = config.risk.maxPositionNotionalPerSymbol - currentExposure;
    const targetNotional = calculateBidNotional(candidate.opportunity, researchConfig);
    const notional = roundNotional(
      Math.min(targetNotional, config.risk.maxNotionalPerOrder, remainingForSymbol, params.account.buyingPower)
    );

    if (!candidate.position && params.openPositionsCount >= researchConfig.maxOpenPositions) {
      reasons.push(`Research auto-trade max open positions reached: ${researchConfig.maxOpenPositions}.`);
    }
    if (hasRecentTrade(params.recentResearchTrades, candidate.symbol, "buy", params.cooldownSince)) {
      reasons.push(
        `${candidate.symbol} already had a research auto-trade buy within the ${researchConfig.symbolCooldownMinutes} minute cooldown.`
      );
    }
    if (notional < researchConfig.minNotionalPerOrder) {
      reasons.push(
        `No notional capacity remains for the minimum $${researchConfig.minNotionalPerOrder.toFixed(2)} bid on this symbol or account.`
      );
    }

    if (reasons.length === 0) {
      orderRequest = {
        symbol: candidate.symbol,
        side: "buy",
        notional,
        type: "market",
        timeInForce: "day",
        clientOrderId: createClientOrderId(candidate.symbol)
      };
      reasons.push("Accepted by research auto-trade paper limits.");
    }
  } else {
    if (!candidate.position || candidate.position.qty <= 0) {
      reasons.push("No long paper position is available to sell.");
    }
    if (hasRecentTrade(params.recentResearchTrades, candidate.symbol, "sell", params.cooldownSince)) {
      reasons.push(
        `${candidate.symbol} already had a research auto-trade sell within the ${researchConfig.symbolCooldownMinutes} minute cooldown.`
      );
    }

    if (reasons.length === 0) {
      orderRequest = {
        symbol: candidate.symbol,
        side: "sell",
        qty: candidate.position?.qty,
        type: "market",
        timeInForce: "day",
        clientOrderId: createClientOrderId(candidate.symbol)
      };
      reasons.push("Accepted bearish research exit for existing paper position.");
    }
  }

  return {
    symbol: candidate.symbol,
    action: reasons.length === 0 || orderRequest ? candidate.action : "skip",
    accepted: Boolean(orderRequest),
    reasons,
    confidence: candidate.opportunity.confidence,
    score: candidate.opportunity.score,
    thesis: candidate.opportunity.thesis,
    catalyst: candidate.opportunity.catalyst,
    opportunityIds,
    sourceUrls,
    orderRequest
  };
}

async function loadActiveOpportunities(now: Date): Promise<ResearchAutoTradeOpportunityInput[]> {
  const rows = await prisma.opportunity.findMany({
    where: {
      status: "active",
      expiresAt: { gt: now }
    },
    orderBy: [{ score: "desc" }, { lastSeenAt: "desc" }],
    take: 120
  });
  const sourceItemIds = uniqueStrings(rows.flatMap((row) => parseStringArray(row.sourceItemIdsJson)));
  const sourceRows =
    sourceItemIds.length > 0
      ? await prisma.researchItem.findMany({
          where: { id: { in: sourceItemIds } },
          select: { id: true, sourceUrl: true }
        })
      : [];
  const sourceById = new Map(sourceRows.map((source) => [source.id, source]));

  return rows.map((row) => {
    const rowSourceIds = parseStringArray(row.sourceItemIdsJson);
    return {
      id: row.id,
      symbol: row.symbol.toUpperCase(),
      direction: parseDirection(row.direction),
      thesis: row.thesis,
      catalyst: row.catalyst,
      confidence: row.confidence,
      score: row.score,
      riskFlags: parseStringArray(row.riskFlagsJson),
      expiresAt: row.expiresAt,
      sourceItemIds: rowSourceIds,
      sourceUrls: uniqueStrings(rowSourceIds.map((id) => sourceById.get(id)?.sourceUrl ?? ""))
    };
  });
}

async function loadRecentResearchTrades(since: Date): Promise<ResearchAutoTradeRecentTradeInput[]> {
  const rows = await prisma.trade.findMany({
    where: {
      strategy: "research_auto",
      createdAt: { gte: since }
    },
    select: {
      symbol: true,
      side: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  return rows.map((row) => ({
    symbol: row.symbol,
    side: row.side === "sell" ? "sell" : "buy",
    createdAt: row.createdAt
  }));
}

async function countResearchTradesSince(since: Date): Promise<number> {
  return prisma.trade.count({
    where: {
      strategy: "research_auto",
      createdAt: { gte: since }
    }
  });
}

async function getRealizedPnlToday(): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.trade.findMany({
    where: {
      createdAt: { gte: since },
      realizedPnl: { not: null }
    },
    select: { realizedPnl: true }
  });
  return rows.reduce((sum, row) => sum + (row.realizedPnl ?? 0), 0);
}

async function recordSubmittedResearchOrder(params: {
  order: {
    id: string;
    symbol: string;
    side: OrderSide;
    status: string;
    notional?: number;
    qty?: number;
    filledAvgPrice?: number;
  };
  orderRequest: OrderRequest;
  item: ResearchAutoTradeItemResult;
  persist: boolean;
}) {
  if (!params.persist) return;

  const rationale = buildRationale(params.item);
  const tradeOutcomeJson = JSON.stringify({
    source: "research_auto_trade",
    opportunityIds: params.item.opportunityIds,
    sourceUrls: params.item.sourceUrls,
    score: params.item.score,
    confidence: params.item.confidence,
    orderRequest: params.orderRequest
  });

  await prisma.$transaction([
    prisma.trade.create({
      data: {
        symbol: params.order.symbol,
        side: params.order.side,
        strategy: "research_auto",
        qty: params.order.qty,
        notional: params.order.notional ?? params.orderRequest.notional,
        price: params.order.filledAvgPrice,
        orderId: params.order.id,
        status: params.order.status,
        rationale,
        tradeOutcomeJson
      }
    }),
    prisma.learningEvent.create({
      data: {
        symbol: params.order.symbol,
        reward: 0,
        summary: `${params.order.symbol} research-auto paper ${params.order.side} submitted from source-backed opportunity: ${params.item.catalyst}. Outcome learning will update after reconciliation.`,
        source: "research_auto_trade"
      }
    })
  ]);
}

function buildResult(params: {
  startedAt: Date;
  now: Date;
  dryRun: boolean;
  config: BotRuntimeConfig;
  researchConfig: ResearchAutoTradeConfig;
  items: ResearchAutoTradeItemResult[];
  submittedOrders?: number;
}): ResearchAutoTradeResult {
  return {
    startedAt: params.startedAt.toISOString(),
    finishedAt: params.now.toISOString(),
    enabled: params.researchConfig.enabled,
    dryRun: params.dryRun,
    tradingMode: params.config.tradingMode,
    submittedOrders: params.submittedOrders ?? 0,
    candidatesEvaluated: params.items.length,
    config: params.researchConfig,
    items: params.items
  };
}

function selectBestOpportunity(opportunities: ResearchAutoTradeOpportunityInput[]) {
  return [...opportunities].sort((left, right) => {
    const scoreDiff = Math.abs(right.score) - Math.abs(left.score);
    if (scoreDiff !== 0) return scoreDiff;
    return right.confidence - left.confidence;
  })[0];
}

function hasRecentTrade(
  trades: ResearchAutoTradeRecentTradeInput[],
  symbol: string,
  side: OrderSide,
  since: Date
): boolean {
  return trades.some((trade) => trade.symbol === symbol && trade.side === side && parseDate(trade.createdAt) >= since);
}

function hasLongPosition(position: PositionSnapshot): boolean {
  return position.qty > 0 || position.marketValue > 0;
}

function parseDirection(value: string): ResearchAutoTradeOpportunityInput["direction"] {
  if (value === "bullish" || value === "bearish") return value;
  return "watch";
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function roundNotional(value: number): number {
  return Math.floor(value * 100) / 100;
}

function calculateBidNotional(
  opportunity: ResearchAutoTradeOpportunityInput,
  researchConfig: ResearchAutoTradeConfig
): number {
  const minBid = researchConfig.minNotionalPerOrder;
  const maxBid = Math.max(minBid, researchConfig.maxNotionalPerOrder);
  if (minBid === maxBid) return minBid;

  const strength = Math.min(1, Math.max(0, (Math.abs(opportunity.score) + opportunity.confidence) / 2));
  return minBid + (maxBid - minBid) * strength;
}

function createClientOrderId(symbol: string): string {
  return `bb-ra-${symbol.toLowerCase()}-${Date.now()}`;
}

function buildRationale(item: ResearchAutoTradeItemResult): string {
  return `[research_auto] ${item.symbol} ${item.action} candidate. Confidence ${item.confidence.toFixed(
    2
  )}, score ${item.score.toFixed(2)}. ${item.thesis} Catalyst: ${item.catalyst}.`;
}
