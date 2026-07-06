import { z } from "zod";
import type { BotRuntimeConfig, TradingMode } from "@/lib/types/trading";

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
  BOT_POLL_INTERVAL_SECONDS: numberFromEnv(300)
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

  return {
    openAiConfigured: isOpenAiConfigured(env),
    alpacaConfigured: isAlpacaConfigured(env),
    openAiModel: env.OPENAI_MODEL,
    openAiReasoningEffort: env.OPENAI_REASONING_EFFORT,
    openAiStoreResponses: env.OPENAI_STORE_RESPONSES,
    tradingMode: config.tradingMode,
    liveTradingEnabled: config.liveTradingEnabled,
    watchlist: config.watchlist,
    rsi: {
      period: config.rsiPeriod,
      timeframe: config.timeframe,
      oversold: config.oversoldThreshold,
      overbought: config.overboughtThreshold
    },
    risk: config.risk
  };
}
