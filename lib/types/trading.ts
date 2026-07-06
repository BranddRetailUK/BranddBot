export type TradingMode = "paper" | "live";
export type TradeAction = "buy" | "sell" | "hold" | "block";
export type OrderSide = "buy" | "sell";

export type MarketBar = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type AccountSnapshot = {
  id?: string;
  status?: string;
  currency?: string;
  buyingPower: number;
  cash: number;
  portfolioValue: number;
};

export type PositionSnapshot = {
  symbol: string;
  qty: number;
  marketValue: number;
  avgEntryPrice: number;
  unrealizedPnl: number;
};

export type OrderRequest = {
  symbol: string;
  side: OrderSide;
  notional?: number;
  qty?: number;
  type?: "market" | "limit";
  timeInForce?: "day" | "gtc";
  clientOrderId?: string;
};

export type OrderResult = {
  id: string;
  symbol: string;
  side: OrderSide;
  status: string;
  notional?: number;
  qty?: number;
  filledAvgPrice?: number;
};

export type BrokerOrderSnapshot = OrderResult & {
  filledAt?: string;
  submittedAt?: string;
};

export type TradeFillActivity = {
  id: string;
  orderId?: string;
  symbol: string;
  side: OrderSide;
  qty: number;
  price: number;
  transactionTime: string;
};

export type RsiSignal = {
  symbol: string;
  action: Exclude<TradeAction, "block">;
  rsi?: number;
  previousRsi?: number;
  confidence: number;
  reason: string;
  recommendedNotional?: number;
};

export type RiskLimits = {
  maxNotionalPerOrder: number;
  maxPositionNotionalPerSymbol: number;
  maxDailyLossUsd: number;
  maxOpenPositions: number;
  minAiConfidence: number;
};

export type BotRuntimeConfig = {
  watchlist: string[];
  rsiPeriod: number;
  timeframe: string;
  oversoldThreshold: number;
  overboughtThreshold: number;
  tradingMode: TradingMode;
  liveTradingEnabled: boolean;
  pollIntervalSeconds: number;
  risk: RiskLimits;
};

export type RecentTradeSummary = {
  symbol: string;
  side: string;
  notional?: number;
  qty?: number;
  price?: number;
  realizedPnl?: number;
  status: string;
  createdAt: string;
  closedAt?: string;
};

export type ResearchBrief = {
  symbol: string;
  direction: "bullish" | "bearish" | "watch";
  thesis: string;
  catalyst: string;
  confidence: number;
  score: number;
  riskFlags: string[];
  expiresAt: string;
};

export type TradingContext = {
  symbol: string;
  generatedAt: string;
  currentPrice: number;
  barSummary: {
    timeframe: string;
    count: number;
    firstClose?: number;
    lastClose?: number;
    high?: number;
    low?: number;
    volume?: number;
  };
  rsi: {
    period: number;
    current?: number;
    previous?: number;
    oversoldThreshold: number;
    overboughtThreshold: number;
  };
  deterministicSignal: RsiSignal;
  position?: PositionSnapshot;
  account: AccountSnapshot;
  openPositionsCount: number;
  recentTrades: RecentTradeSummary[];
  realizedPnlToday: number;
  riskLimits: RiskLimits;
  priorLessons: string[];
  researchBriefs: ResearchBrief[];
};

export type LearningUpdate = {
  summary: string;
  rewardSignal: number;
  observations: string[];
  mistakesToAvoid: string[];
};

export type RecommendedParameterAdjustments = {
  rsiPeriod?: number;
  oversoldThreshold?: number;
  overboughtThreshold?: number;
  maxNotionalMultiplier?: number;
};

export type AiTradingDecision = {
  decision: TradeAction;
  confidence: number;
  rationale: string;
  riskFlags: string[];
  learningUpdate: LearningUpdate;
  recommendedParameterAdjustments: RecommendedParameterAdjustments;
};

export type AiDecisionResult = AiTradingDecision & {
  configured: boolean;
  promptHash: string;
  inputJson: string;
  outputJson: string;
  openAiResponseId?: string;
};

export type RiskGateResult = {
  accepted: boolean;
  finalAction: TradeAction;
  reasons: string[];
  order?: OrderRequest;
};

export type ScanSymbolResult = {
  symbol: string;
  signal: RsiSignal;
  aiDecision: AiDecisionResult;
  riskGate: RiskGateResult;
  order?: OrderResult;
};

export type ScanResult = {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  tradingMode: TradingMode;
  symbols: ScanSymbolResult[];
};

export type NewsArticle = {
  id: string;
  source: string;
  url: string;
  headline: string;
  summary?: string;
  content?: string;
  symbols: string[];
  createdAt: string;
  updatedAt?: string;
};

export type ResearchAnalysis = {
  sentiment: ResearchBrief["direction"];
  catalyst: string;
  thesis: string;
  confidence: number;
  score: number;
  riskFlags: string[];
  expiresAt: string;
};

export type ResearchCrawlResult = {
  startedAt: string;
  finishedAt: string;
  source: string;
  scannedArticles: number;
  storedItems: number;
  updatedItems: number;
  opportunitiesCreated: number;
  opportunitiesUpdated: number;
  symbols: string[];
};

export type ReconcileResult = {
  startedAt: string;
  finishedAt: string;
  checkedTrades: number;
  updatedOrders: number;
  closedTrades: number;
  learningEvents: number;
};

export type TradePlanSuggestedAction = "watch" | "buy_candidate" | "sell_candidate" | "avoid";

export type TradePlanItemSummary = {
  id?: string;
  rank: number;
  symbol: string;
  suggestedAction: TradePlanSuggestedAction;
  thesis: string;
  catalyst: string;
  confidence: number;
  score: number;
  riskNotes: string[];
  eligibleForRsi: boolean;
  tradableNow: boolean;
  tradabilityReason: string;
  opportunityIds: string[];
  sourceUrls: string[];
  learningNotes: string[];
  position?: PositionSnapshot;
  createdAt?: string;
};

export type TradePlanResult = {
  id: string;
  status: string;
  generatedAt: string;
  createdAt: string;
  inputSummary: {
    opportunityCount: number;
    positionCount: number;
    learningNoteCount: number;
    watchlist: string[];
    advisoryOnly: boolean;
  };
  items: TradePlanItemSummary[];
};
