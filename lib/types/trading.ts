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
  realizedPnl?: number;
  status: string;
  createdAt: string;
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
