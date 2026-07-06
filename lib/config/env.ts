import { z } from "zod";
import type { BotRuntimeConfig, ResearchAutoTradeConfig, TradingMode } from "@/lib/types/trading";

const numberFromEnv = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return defaultValue;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : defaultValue;
    });

const booleanFromEnv = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return defaultValue;
      return ["true", "1", "yes", "on"].includes(value.toLowerCase());
    });

const envSchema = z.object({
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().optional().default("gpt-5.5"),
  OPENAI_REASONING_EFFORT: z
    .enum(["low", "medium", "high", "xhigh"])
    .optional()
    .default("medium"),
  OPENAI_TEXT_VERBOSITY: z.enum(["low", "medium", "high"]).optional().default("low"),
  OPENAI_STORE_RESPONSES: booleanFromEnv(false),
  APCA_API_KEY_ID: z.string().optional().default(""),
  APCA_API_SECRET_KEY: z.string().optional().default(""),
  APCA_API_BASE_URL: z.string().url().optional().default("https://paper-api.alpaca.markets"),
  ALPACA_DATA_BASE_URL: z.string().url().optional().default("https://data.alpaca.markets"),
  TRADING_MODE: z.enum(["paper", "live"]).optional().default("paper"),
  LIVE_TRADING_ENABLED: booleanFromEnv(false),
  WATCHLIST: z.string().optional().default("AAPL,MSFT,SPY,QQQ"),
  RSI_PERIOD: numberFromEnv(14),
  RSI_TIMEFRAME: z.string().optional().default("5Min"),
  RSI_OVERSOLD: numberFromEnv(30),
  RSI_OVERBOUGHT: numberFromEnv(70),
  MIN_AI_CONFIDENCE: numberFromEnv(0.55),
  MAX_NOTIONAL_PER_ORDER: numberFromEnv(10),
  MAX_POSITION_NOTIONAL_PER_SYMBOL: numberFromEnv(25),
  MAX_DAILY_LOSS_USD: numberFromEnv(5),
  MAX_OPEN_POSITIONS: numberFromEnv(3),
  BOT_POLL_INTERVAL_SECONDS: numberFromEnv(60),
  RESEARCH_SYMBOLS: z.string().optional().default(""),
  RESEARCH_LOOKBACK_HOURS: numberFromEnv(24),
  RESEARCH_NEWS_LIMIT: numberFromEnv(50),
  RESEARCH_OPPORTUNITY_TTL_HOURS: numberFromEnv(72),
  RESEARCH_MIN_CONFIDENCE: numberFromEnv(0.35),
  RESEARCH_AUTO_TRADE_ENABLED: booleanFromEnv(false),
  RESEARCH_AUTO_TRADE_MIN_CONFIDENCE: numberFromEnv(0.55),
  RESEARCH_AUTO_TRADE_MIN_SCORE: numberFromEnv(0.45),
  RESEARCH_AUTO_TRADE_NOTIONAL: numberFromEnv(1),
  RESEARCH_AUTO_TRADE_MAX_ITEMS_PER_RUN: numberFromEnv(1),
  RESEARCH_AUTO_TRADE_MAX_OPEN_POSITIONS: numberFromEnv(25),
  RESEARCH_AUTO_TRADE_MAX_DAILY_ORDERS: numberFromEnv(100),
  RESEARCH_AUTO_TRADE_SYMBOL_COOLDOWN_MINUTES: numberFromEnv(60)
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse(process.env);
}

export function isOpenAiConfigured(env = getEnv()): boolean {
  return env.OPENAI_API_KEY.trim().length > 0;
}

export function isAlpacaConfigured(env = getEnv()): boolean {
  return env.APCA_API_KEY_ID.trim().length > 0 && env.APCA_API_SECRET_KEY.trim().length > 0;
}

export function getBotRuntimeConfig(env = getEnv()): BotRuntimeConfig {
  const watchlist = env.WATCHLIST.split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  return {
    watchlist,
    rsiPeriod: Math.max(2, Math.floor(env.RSI_PERIOD)),
    timeframe: env.RSI_TIMEFRAME,
    oversoldThreshold: env.RSI_OVERSOLD,
    overboughtThreshold: env.RSI_OVERBOUGHT,
    tradingMode: env.TRADING_MODE as TradingMode,
    liveTradingEnabled: env.LIVE_TRADING_ENABLED,
    paperTradingEndpoint: env.APCA_API_BASE_URL.includes("paper"),
    pollIntervalSeconds: Math.max(30, env.BOT_POLL_INTERVAL_SECONDS),
    risk: {
      maxNotionalPerOrder: Math.max(1, env.MAX_NOTIONAL_PER_ORDER),
      maxPositionNotionalPerSymbol: Math.max(1, env.MAX_POSITION_NOTIONAL_PER_SYMBOL),
      maxDailyLossUsd: Math.max(0, env.MAX_DAILY_LOSS_USD),
      maxOpenPositions: Math.max(1, Math.floor(env.MAX_OPEN_POSITIONS)),
      minAiConfidence: Math.min(1, Math.max(0, env.MIN_AI_CONFIDENCE))
    }
  };
}

export function getPublicRuntimeSummary() {
  const env = getEnv();
  const config = getBotRuntimeConfig(env);
  const researchSymbols = getResearchSymbols(env, config.watchlist);
  const researchAutoTrade = getResearchAutoTradeRuntimeConfig(env);

  return {
    openAiConfigured: isOpenAiConfigured(env),
    alpacaConfigured: isAlpacaConfigured(env),
    openAiModel: env.OPENAI_MODEL,
    openAiReasoningEffort: env.OPENAI_REASONING_EFFORT,
    openAiStoreResponses: env.OPENAI_STORE_RESPONSES,
    tradingMode: config.tradingMode,
    liveTradingEnabled: config.liveTradingEnabled,
    paperTradingEndpoint: config.paperTradingEndpoint,
    watchlist: config.watchlist,
    rsi: {
      period: config.rsiPeriod,
      timeframe: config.timeframe,
      oversold: config.oversoldThreshold,
      overbought: config.overboughtThreshold
    },
    risk: config.risk,
    research: {
      symbols: researchSymbols,
      lookbackHours: Math.max(1, env.RESEARCH_LOOKBACK_HOURS),
      newsLimit: Math.min(50, Math.max(1, Math.floor(env.RESEARCH_NEWS_LIMIT))),
      opportunityTtlHours: Math.max(1, env.RESEARCH_OPPORTUNITY_TTL_HOURS),
      minConfidence: Math.min(1, Math.max(0, env.RESEARCH_MIN_CONFIDENCE))
    },
    researchAutoTrade
  };
}

export function getResearchRuntimeConfig(env = getEnv(), fallbackSymbols?: string[]) {
  return {
    symbols: getResearchSymbols(env, fallbackSymbols),
    lookbackHours: Math.max(1, env.RESEARCH_LOOKBACK_HOURS),
    newsLimit: Math.min(50, Math.max(1, Math.floor(env.RESEARCH_NEWS_LIMIT))),
    opportunityTtlHours: Math.max(1, env.RESEARCH_OPPORTUNITY_TTL_HOURS),
    minConfidence: Math.min(1, Math.max(0, env.RESEARCH_MIN_CONFIDENCE))
  };
}

export function getResearchAutoTradeRuntimeConfig(env = getEnv()): ResearchAutoTradeConfig {
  return {
    enabled: env.RESEARCH_AUTO_TRADE_ENABLED,
    minConfidence: clamp(env.RESEARCH_AUTO_TRADE_MIN_CONFIDENCE, 0, 1),
    minScore: clamp(env.RESEARCH_AUTO_TRADE_MIN_SCORE, 0, 1),
    notionalPerOrder: Math.max(1, env.RESEARCH_AUTO_TRADE_NOTIONAL),
    maxItemsPerRun: Math.max(1, Math.floor(env.RESEARCH_AUTO_TRADE_MAX_ITEMS_PER_RUN)),
    maxOpenPositions: Math.max(1, Math.floor(env.RESEARCH_AUTO_TRADE_MAX_OPEN_POSITIONS)),
    maxDailyOrders: Math.max(1, Math.floor(env.RESEARCH_AUTO_TRADE_MAX_DAILY_ORDERS)),
    symbolCooldownMinutes: Math.max(0, Math.floor(env.RESEARCH_AUTO_TRADE_SYMBOL_COOLDOWN_MINUTES))
  };
}

function getResearchSymbols(env: AppEnv, fallbackSymbols?: string[]): string[] {
  const symbols = env.RESEARCH_SYMBOLS.split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  return symbols.length > 0 ? symbols : fallbackSymbols ?? getBotRuntimeConfig(env).watchlist;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
