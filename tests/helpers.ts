import type { AppEnv } from "@/lib/config/env";
import type { BotRuntimeConfig, MarketBar } from "@/lib/types/trading";

export function testEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "gpt-5.5",
    OPENAI_REASONING_EFFORT: "medium",
    OPENAI_TEXT_VERBOSITY: "low",
    OPENAI_STORE_RESPONSES: false,
    OPENAI_REVIEW_HOLD_SIGNALS: false,
    APCA_API_KEY_ID: "paper-key",
    APCA_API_SECRET_KEY: "paper-secret",
    APCA_API_BASE_URL: "https://paper-api.alpaca.markets",
    ALPACA_DATA_BASE_URL: "https://data.alpaca.markets",
    TRADING_MODE: "paper",
    LIVE_TRADING_ENABLED: false,
    WATCHLIST: "AAPL",
    RSI_PERIOD: 2,
    RSI_TIMEFRAME: "5Min",
    RSI_OVERSOLD: 30,
    RSI_OVERBOUGHT: 70,
    MIN_AI_CONFIDENCE: 0.55,
    MAX_NOTIONAL_PER_ORDER: 10,
    MAX_POSITION_NOTIONAL_PER_SYMBOL: 25,
    MAX_DAILY_LOSS_USD: 5,
    MAX_OPEN_POSITIONS: 3,
    BOT_POLL_INTERVAL_SECONDS: 300,
    RESEARCH_SYMBOLS: "",
    RESEARCH_MAX_SYMBOLS: 8,
    RESEARCH_LOOKBACK_HOURS: 6,
    RESEARCH_NEWS_LIMIT: 20,
    RESEARCH_OPPORTUNITY_TTL_HOURS: 24,
    RESEARCH_MIN_CONFIDENCE: 0.35,
    RESEARCH_AUTO_TRADE_ENABLED: false,
    RESEARCH_AUTO_TRADE_MIN_CONFIDENCE: 0.55,
    RESEARCH_AUTO_TRADE_MIN_SCORE: 0.45,
    RESEARCH_AUTO_TRADE_NOTIONAL: 1,
    RESEARCH_AUTO_TRADE_MAX_ITEMS_PER_RUN: 1,
    RESEARCH_AUTO_TRADE_MAX_OPEN_POSITIONS: 10,
    RESEARCH_AUTO_TRADE_MAX_DAILY_ORDERS: 20,
    RESEARCH_AUTO_TRADE_SYMBOL_COOLDOWN_MINUTES: 240,
    ...overrides
  };
}

export function testConfig(): BotRuntimeConfig {
  return {
    watchlist: ["AAPL"],
    rsiPeriod: 2,
    timeframe: "5Min",
    oversoldThreshold: 30,
    overboughtThreshold: 70,
    openAiReviewHoldSignals: false,
    tradingMode: "paper",
    liveTradingEnabled: false,
    paperTradingEndpoint: true,
    pollIntervalSeconds: 300,
    risk: {
      maxNotionalPerOrder: 10,
      maxPositionNotionalPerSymbol: 25,
      maxDailyLossUsd: 5,
      maxOpenPositions: 3,
      minAiConfidence: 0.55
    }
  };
}

export function oversoldBars(): MarketBar[] {
  const closes = [100, 95, 90, 85, 80, 75, 70, 68, 66, 65, 64, 63];
  return closes.map((close, index) => ({
    timestamp: new Date(Date.UTC(2026, 0, 1, 14, index)).toISOString(),
    open: close + 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1000 + index
  }));
}
