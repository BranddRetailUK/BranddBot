import { AlpacaBroker } from "@/lib/broker/alpaca";
import type { BrokerAdapter } from "@/lib/broker/types";
import { getBotRuntimeConfig, getEnv, isAlpacaConfigured } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import type {
  BotRuntimeConfig,
  PositionSnapshot,
  TradePlanItemSummary,
  TradePlanResult,
  TradePlanSuggestedAction
} from "@/lib/types/trading";

export type PlanOpportunityInput = {
  id: string;
  symbol: string;
  direction: "bullish" | "bearish" | "watch";
  thesis: string;
  catalyst: string;
  confidence: number;
  score: number;
  riskFlags: string[];
  expiresAt: string | Date;
  sourceItemIds?: string[];
  sourceUrls?: string[];
  sourceHeadlines?: string[];
};

export type PlanLearningInput = {
  symbol: string;
  reward: number;
  summary: string;
  source?: string;
  createdAt?: string | Date;
};

export type BuildTradePlanOptions = {
  broker?: Pick<BrokerAdapter, "getPositions">;
  config?: BotRuntimeConfig;
  now?: Date;
  maxItems?: number;
  opportunities?: PlanOpportunityInput[];
  positions?: PositionSnapshot[];
  learningEvents?: PlanLearningInput[];
  persist?: boolean;
};

type PlanInputSummary = TradePlanResult["inputSummary"];

type PersistedPlan = {
  id: string;
  status: string;
  inputSummaryJson: string;
  generatedAt: Date;
  createdAt: Date;
  items: Array<{
    id: string;
    rank: number;
    symbol: string;
    suggestedAction: string;
    thesis: string;
    catalyst: string;
    confidence: number;
    score: number;
    riskNotesJson: string;
    eligibleForRsi: boolean;
    tradableNow: boolean;
    tradabilityReason: string;
    opportunityIdsJson: string;
    sourceUrlsJson: string;
    learningNotesJson: string;
    positionJson: string | null;
    createdAt: Date;
  }>;
};

export async function buildTradePlan(options: BuildTradePlanOptions = {}): Promise<TradePlanResult> {
  const now = options.now ?? new Date();
  const config = options.config ?? getBotRuntimeConfig();
  const maxItems = Math.max(1, Math.floor(options.maxItems ?? 20));
  const opportunities = options.opportunities ?? (await loadActiveOpportunities(now));
  const positions = options.positions ?? (await loadCurrentPositions(options.broker));
  const symbols = uniqueStrings([
    ...opportunities.map((opportunity) => opportunity.symbol),
    ...positions.filter(hasLongPosition).map((position) => position.symbol)
  ]);
  const learningEvents = options.learningEvents ?? (await loadLearningEvents(symbols));
  const items = rankPlanItems(
    buildPlanItems({
      opportunities,
      positions,
      learningEvents,
      config
    })
  ).slice(0, maxItems);

  const inputSummary: PlanInputSummary = {
    opportunityCount: opportunities.length,
    positionCount: positions.filter(hasLongPosition).length,
    learningNoteCount: learningEvents.length,
    watchlist: config.watchlist,
    advisoryOnly: true
  };

  if (options.persist === false) {
    return {
      id: `preview-${now.getTime()}`,
      status: "preview",
      generatedAt: now.toISOString(),
      createdAt: now.toISOString(),
      inputSummary,
      items: items.map((item, index) => ({ ...item, rank: index + 1 }))
    };
  }

  return persistTradePlan({ now, inputSummary, items });
}

export async function getLatestTradePlan(): Promise<TradePlanResult | undefined> {
  const plan = await prisma.tradePlan.findFirst({
    orderBy: { generatedAt: "desc" },
    include: {
      items: {
        orderBy: { rank: "asc" }
      }
    }
  });

  return plan ? mapPersistedPlan(plan) : undefined;
}

async function loadActiveOpportunities(now: Date): Promise<PlanOpportunityInput[]> {
  const rows = await prisma.opportunity.findMany({
    where: {
      status: "active",
      expiresAt: { gt: now }
    },
    orderBy: [{ score: "desc" }, { lastSeenAt: "desc" }],
    take: 80
  });
  const sourceItemIds = uniqueStrings(rows.flatMap((row) => parseStringArray(row.sourceItemIdsJson)));
  const sourceRows =
    sourceItemIds.length > 0
      ? await prisma.researchItem.findMany({
          where: { id: { in: sourceItemIds } },
          select: { id: true, sourceUrl: true, headline: true }
        })
      : [];
  const sourceById = new Map(sourceRows.map((source) => [source.id, source]));

  return rows.map((row) => {
    const rowSourceIds = parseStringArray(row.sourceItemIdsJson);
    const sources = rowSourceIds.map((id) => sourceById.get(id)).filter((source): source is NonNullable<typeof source> =>
      Boolean(source)
    );

    return {
      id: row.id,
      symbol: row.symbol,
      direction: parseDirection(row.direction),
      thesis: row.thesis,
      catalyst: row.catalyst,
      confidence: row.confidence,
      score: row.score,
      riskFlags: parseStringArray(row.riskFlagsJson),
      expiresAt: row.expiresAt,
      sourceItemIds: rowSourceIds,
      sourceUrls: sources.map((source) => source.sourceUrl),
      sourceHeadlines: sources.map((source) => source.headline)
    };
  });
}

async function loadCurrentPositions(broker?: Pick<BrokerAdapter, "getPositions">): Promise<PositionSnapshot[]> {
  const env = getEnv();
  const positionBroker = broker ?? (isAlpacaConfigured(env) ? new AlpacaBroker(env) : undefined);
  if (!positionBroker) return [];

  try {
    return (await positionBroker.getPositions()).map((position) => ({
      ...position,
      symbol: position.symbol.toUpperCase()
    }));
  } catch {
    return [];
  }
}

async function loadLearningEvents(symbols: string[]): Promise<PlanLearningInput[]> {
  if (symbols.length === 0) return [];

  const rows = await prisma.learningEvent.findMany({
    where: { symbol: { in: symbols } },
    orderBy: { createdAt: "desc" },
    take: Math.max(40, symbols.length * 8)
  });

  return rows.map((row) => ({
    symbol: row.symbol,
    reward: row.reward,
    summary: row.summary,
    source: row.source,
    createdAt: row.createdAt
  }));
}

function buildPlanItems(params: {
  opportunities: PlanOpportunityInput[];
  positions: PositionSnapshot[];
  learningEvents: PlanLearningInput[];
  config: BotRuntimeConfig;
}): TradePlanItemSummary[] {
  const symbols = uniqueStrings([
    ...params.opportunities.map((opportunity) => opportunity.symbol),
    ...params.positions.filter(hasLongPosition).map((position) => position.symbol)
  ]);
  const openPositionsCount = params.positions.filter(hasLongPosition).length;

  return symbols.map((symbol) => {
    const opportunities = params.opportunities.filter((opportunity) => opportunity.symbol === symbol);
    const position = params.positions.find((item) => item.symbol === symbol && hasLongPosition(item));
    const learningNotes = params.learningEvents
      .filter((event) => event.symbol === symbol)
      .slice(0, 4)
      .map((event) => event.summary);
    const bestOpportunity = selectBestOpportunity(opportunities);
    const netResearchScore = clamp(opportunities.reduce((sum, opportunity) => sum + opportunity.score, 0), -1, 1);
    const sourceUrls = uniqueStrings(opportunities.flatMap((opportunity) => opportunity.sourceUrls ?? []));
    const sourceHeadlines = uniqueStrings(opportunities.flatMap((opportunity) => opportunity.sourceHeadlines ?? []));
    const suggestedAction = chooseSuggestedAction({ netResearchScore, position, hasOpportunity: opportunities.length > 0 });
    const eligibleForRsi = params.config.watchlist.includes(symbol);
    const tradability = getTradability({
      symbol,
      action: suggestedAction,
      eligibleForRsi,
      position,
      openPositionsCount,
      config: params.config
    });
    const confidence = calculatePlanConfidence({
      opportunities,
      netResearchScore,
      learningEvents: params.learningEvents.filter((event) => event.symbol === symbol)
    });
    const riskNotes = buildRiskNotes({
      symbol,
      opportunities,
      position,
      eligibleForRsi,
      suggestedAction,
      learningEvents: params.learningEvents.filter((event) => event.symbol === symbol)
    });

    return {
      rank: 0,
      symbol,
      suggestedAction,
      thesis: buildPlanThesis({ symbol, suggestedAction, bestOpportunity, position }),
      catalyst: buildCatalyst({ bestOpportunity, sourceHeadlines }),
      confidence,
      score: Number((confidence * 0.65 + Math.abs(netResearchScore) * 0.35).toFixed(4)),
      riskNotes,
      eligibleForRsi,
      tradableNow: tradability.tradableNow,
      tradabilityReason: tradability.reason,
      opportunityIds: opportunities.map((opportunity) => opportunity.id),
      sourceUrls,
      learningNotes,
      position
    };
  });
}

function rankPlanItems(items: TradePlanItemSummary[]): TradePlanItemSummary[] {
  const actionPriority: Record<TradePlanSuggestedAction, number> = {
    buy_candidate: 4,
    sell_candidate: 4,
    avoid: 3,
    watch: 1
  };

  return [...items]
    .sort((left, right) => {
      const scoreDiff = right.score - left.score;
      if (scoreDiff !== 0) return scoreDiff;
      const actionDiff = actionPriority[right.suggestedAction] - actionPriority[left.suggestedAction];
      if (actionDiff !== 0) return actionDiff;
      return left.symbol.localeCompare(right.symbol);
    })
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

async function persistTradePlan(params: {
  now: Date;
  inputSummary: PlanInputSummary;
  items: TradePlanItemSummary[];
}): Promise<TradePlanResult> {
  const plan = await prisma.$transaction(async (tx) => {
    await tx.tradePlan.updateMany({
      where: { status: "active" },
      data: { status: "superseded" }
    });

    return tx.tradePlan.create({
      data: {
        status: "active",
        inputSummaryJson: JSON.stringify(params.inputSummary),
        generatedAt: params.now,
        items: {
          create: params.items.map((item) => ({
            rank: item.rank,
            symbol: item.symbol,
            suggestedAction: item.suggestedAction,
            thesis: item.thesis,
            catalyst: item.catalyst,
            confidence: item.confidence,
            score: item.score,
            riskNotesJson: JSON.stringify(item.riskNotes),
            eligibleForRsi: item.eligibleForRsi,
            tradableNow: item.tradableNow,
            tradabilityReason: item.tradabilityReason,
            opportunityIdsJson: JSON.stringify(item.opportunityIds),
            sourceUrlsJson: JSON.stringify(item.sourceUrls),
            learningNotesJson: JSON.stringify(item.learningNotes),
            positionJson: item.position ? JSON.stringify(item.position) : undefined
          }))
        }
      },
      include: {
        items: {
          orderBy: { rank: "asc" }
        }
      }
    });
  });

  return mapPersistedPlan(plan);
}

function mapPersistedPlan(plan: PersistedPlan): TradePlanResult {
  return {
    id: plan.id,
    status: plan.status,
    generatedAt: plan.generatedAt.toISOString(),
    createdAt: plan.createdAt.toISOString(),
    inputSummary: parseInputSummary(plan.inputSummaryJson),
    items: plan.items.map((item) => ({
      id: item.id,
      rank: item.rank,
      symbol: item.symbol,
      suggestedAction: parseSuggestedAction(item.suggestedAction),
      thesis: item.thesis,
      catalyst: item.catalyst,
      confidence: item.confidence,
      score: item.score,
      riskNotes: parseStringArray(item.riskNotesJson),
      eligibleForRsi: item.eligibleForRsi,
      tradableNow: item.tradableNow,
      tradabilityReason: item.tradabilityReason,
      opportunityIds: parseStringArray(item.opportunityIdsJson),
      sourceUrls: parseStringArray(item.sourceUrlsJson),
      learningNotes: parseStringArray(item.learningNotesJson),
      position: parsePosition(item.positionJson),
      createdAt: item.createdAt.toISOString()
    }))
  };
}

function selectBestOpportunity(opportunities: PlanOpportunityInput[]): PlanOpportunityInput | undefined {
  return [...opportunities].sort((left, right) => {
    const scoreDiff = Math.abs(right.score) - Math.abs(left.score);
    if (scoreDiff !== 0) return scoreDiff;
    return right.confidence - left.confidence;
  })[0];
}

function chooseSuggestedAction(params: {
  netResearchScore: number;
  position?: PositionSnapshot;
  hasOpportunity: boolean;
}): TradePlanSuggestedAction {
  if (!params.hasOpportunity) return "watch";
  if (params.netResearchScore <= -0.25) return params.position ? "sell_candidate" : "avoid";
  if (params.netResearchScore >= 0.25) return params.position ? "watch" : "buy_candidate";
  return "watch";
}

function getTradability(params: {
  symbol: string;
  action: TradePlanSuggestedAction;
  eligibleForRsi: boolean;
  position?: PositionSnapshot;
  openPositionsCount: number;
  config: BotRuntimeConfig;
}): { tradableNow: boolean; reason: string } {
  if (!params.eligibleForRsi) {
    return {
      tradableNow: false,
      reason: `${params.symbol} is not in WATCHLIST, so the RSI scanner will not evaluate it.`
    };
  }

  if (params.config.tradingMode !== "paper" || params.config.liveTradingEnabled) {
    return {
      tradableNow: false,
      reason: "Paper-only safety is not satisfied; live trading remains blocked in this scaffold."
    };
  }

  if (params.action === "watch") {
    return {
      tradableNow: false,
      reason: "The plan says watch. The scanner may observe it, but this plan item is not a buy or sell candidate."
    };
  }

  if (params.action === "avoid") {
    return {
      tradableNow: false,
      reason: "The plan says avoid because current research is negative or too risky."
    };
  }

  if (params.action === "sell_candidate" && !params.position) {
    return {
      tradableNow: false,
      reason: "There is no current long paper position to sell."
    };
  }

  if (params.action === "buy_candidate") {
    if (!params.position && params.openPositionsCount >= params.config.risk.maxOpenPositions) {
      return {
        tradableNow: false,
        reason: `Max open positions is already reached at ${params.config.risk.maxOpenPositions}.`
      };
    }

    const currentExposure = params.position?.marketValue ?? 0;
    if (currentExposure >= params.config.risk.maxPositionNotionalPerSymbol) {
      return {
        tradableNow: false,
        reason: `Current exposure is already at or above the $${params.config.risk.maxPositionNotionalPerSymbol.toFixed(
          2
        )} per-symbol limit.`
      };
    }
  }

  return {
    tradableNow: true,
    reason:
      "Eligible for RSI scanning. A paper order still requires deterministic RSI, OpenAI alignment, and risk-gate approval."
  };
}

function calculatePlanConfidence(params: {
  opportunities: PlanOpportunityInput[];
  netResearchScore: number;
  learningEvents: PlanLearningInput[];
}): number {
  if (params.opportunities.length === 0) return 0.2;

  const strongestConfidence = Math.max(...params.opportunities.map((opportunity) => opportunity.confidence));
  const sourceBonus = Math.min(0.06, params.opportunities.length * 0.02);
  const averageReward =
    params.learningEvents.length > 0
      ? params.learningEvents.reduce((sum, event) => sum + event.reward, 0) / params.learningEvents.length
      : 0;
  const learningAdjustment = clamp(averageReward * 0.05, -0.05, 0.05);

  return Number(
    clamp(strongestConfidence * 0.65 + Math.abs(params.netResearchScore) * 0.3 + sourceBonus + learningAdjustment, 0.05, 0.95).toFixed(4)
  );
}

function buildRiskNotes(params: {
  symbol: string;
  opportunities: PlanOpportunityInput[];
  position?: PositionSnapshot;
  eligibleForRsi: boolean;
  suggestedAction: TradePlanSuggestedAction;
  learningEvents: PlanLearningInput[];
}): string[] {
  const notes = uniqueStrings(params.opportunities.flatMap((opportunity) => opportunity.riskFlags));

  if (params.opportunities.length === 0) {
    notes.push("No active source-backed opportunity is available for this symbol.");
  }
  if (!params.eligibleForRsi) {
    notes.push(`${params.symbol} is not eligible for RSI scanning until it is added to WATCHLIST.`);
  }
  if (params.suggestedAction === "avoid") {
    notes.push("Current source-backed research is negative, so the plan avoids a new long entry.");
  }
  if (params.position) {
    notes.push(
      `Current paper position: ${params.position.qty.toFixed(4)} shares, ${formatUsd(params.position.marketValue)} market value.`
    );
  }
  if (params.learningEvents.some((event) => event.reward < 0)) {
    notes.push("Recent learning notes include negative reward signals for this symbol.");
  }
  if (notes.length === 0) {
    notes.push("No specific risk flag found beyond normal market risk.");
  }

  return notes;
}

function buildPlanThesis(params: {
  symbol: string;
  suggestedAction: TradePlanSuggestedAction;
  bestOpportunity?: PlanOpportunityInput;
  position?: PositionSnapshot;
}): string {
  if (!params.bestOpportunity) {
    return params.position
      ? `${params.symbol} is already held in the paper account, but there is no active research catalyst. Keep watching for RSI and new source-backed research.`
      : `${params.symbol} has no active research catalyst, so it stays on watch.`;
  }

  if (params.suggestedAction === "buy_candidate") {
    return `${params.bestOpportunity.thesis} Treat this as a buy candidate only if RSI later confirms an entry.`;
  }
  if (params.suggestedAction === "sell_candidate") {
    return `${params.bestOpportunity.thesis} Because the account already holds this symbol, treat it as a sell candidate only if RSI and the risk gate agree.`;
  }
  if (params.suggestedAction === "avoid") {
    return `${params.bestOpportunity.thesis} The plan avoids a new long entry until the risk picture improves.`;
  }
  return `${params.bestOpportunity.thesis} The plan is to watch for confirmation instead of acting from research alone.`;
}

function buildCatalyst(params: { bestOpportunity?: PlanOpportunityInput; sourceHeadlines: string[] }): string {
  if (!params.bestOpportunity) return "No active news catalyst; position-only watch item.";
  const headline = params.sourceHeadlines[0];
  if (headline && headline !== params.bestOpportunity.catalyst) {
    return `${params.bestOpportunity.catalyst}: ${headline}`;
  }
  return params.bestOpportunity.catalyst;
}

function parseInputSummary(value: string): PlanInputSummary {
  const parsed = parseJsonObject(value);
  return {
    opportunityCount: toNumber(parsed.opportunityCount),
    positionCount: toNumber(parsed.positionCount),
    learningNoteCount: toNumber(parsed.learningNoteCount),
    watchlist: parseUnknownArray(parsed.watchlist).map(String),
    advisoryOnly: parsed.advisoryOnly === true
  };
}

function parsePosition(value?: string | null): PositionSnapshot | undefined {
  if (!value) return undefined;
  const parsed = parseJsonObject(value);
  const symbol = typeof parsed.symbol === "string" ? parsed.symbol : undefined;
  if (!symbol) return undefined;
  return {
    symbol,
    qty: toNumber(parsed.qty),
    marketValue: toNumber(parsed.marketValue),
    avgEntryPrice: toNumber(parsed.avgEntryPrice),
    unrealizedPnl: toNumber(parsed.unrealizedPnl)
  };
}

function parseDirection(value: string): PlanOpportunityInput["direction"] {
  if (value === "bullish" || value === "bearish") return value;
  return "watch";
}

function parseSuggestedAction(value: string): TradePlanSuggestedAction {
  if (value === "buy_candidate" || value === "sell_candidate" || value === "avoid") return value;
  return "watch";
}

function hasLongPosition(position: PositionSnapshot): boolean {
  return position.qty > 0 || position.marketValue > 0;
}

function parseStringArray(value: string): string[] {
  return parseUnknownArray(value).map(String).filter(Boolean);
}

function parseUnknownArray(value: unknown): unknown[] {
  try {
    const parsed = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatUsd(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}
