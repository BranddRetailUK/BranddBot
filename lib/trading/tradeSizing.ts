import { getBotRuntimeConfig, getEnv, getResearchAutoTradeRuntimeConfig, type AppEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import type { BotRuntimeConfig, ResearchAutoTradeConfig, TradeSizingSettings } from "@/lib/types/trading";

const TRADE_SIZING_KEY = "trade.sizing";
const MAX_ALLOWED_BID_NOTIONAL = 100_000;

export function getDefaultTradeSizingSettings(env: AppEnv = getEnv()): TradeSizingSettings {
  const minBidNotional = Math.max(1, env.RESEARCH_AUTO_TRADE_NOTIONAL);
  const maxBidNotional = Math.max(minBidNotional, env.MAX_NOTIONAL_PER_ORDER);
  const maxPositionNotionalPerSymbol = Math.max(maxBidNotional, env.MAX_POSITION_NOTIONAL_PER_SYMBOL);

  return {
    minBidNotional,
    maxBidNotional,
    maxPositionNotionalPerSymbol
  };
}

export async function getTradeSizingSettings(): Promise<TradeSizingSettings> {
  const defaults = getDefaultTradeSizingSettings();
  const row = await prisma.botConfig.findUnique({ where: { key: TRADE_SIZING_KEY } }).catch(() => null);
  if (!row) return defaults;

  return {
    ...normalizeTradeSizingSettings(parseTradeSizingJson(row.value), defaults),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function setTradeSizingSettings(input: Partial<TradeSizingSettings>): Promise<TradeSizingSettings> {
  const normalized = normalizeTradeSizingSettings(input, getDefaultTradeSizingSettings());
  const row = await prisma.botConfig.upsert({
    where: { key: TRADE_SIZING_KEY },
    update: { value: JSON.stringify(normalized) },
    create: { key: TRADE_SIZING_KEY, value: JSON.stringify(normalized) }
  });

  return {
    ...normalized,
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function getTradeSizedRuntimeConfig() {
  const tradeSizing = await getTradeSizingSettings();
  return {
    tradeSizing,
    config: applyTradeSizingToBotConfig(getBotRuntimeConfig(), tradeSizing),
    researchConfig: applyTradeSizingToResearchAutoTradeConfig(getResearchAutoTradeRuntimeConfig(), tradeSizing)
  };
}

export function applyTradeSizingToBotConfig(
  config: BotRuntimeConfig,
  tradeSizing: TradeSizingSettings
): BotRuntimeConfig {
  const sizing = normalizeTradeSizingSettings(tradeSizing, getDefaultTradeSizingSettings());
  return {
    ...config,
    risk: {
      ...config.risk,
      maxNotionalPerOrder: sizing.maxBidNotional,
      maxPositionNotionalPerSymbol: sizing.maxPositionNotionalPerSymbol
    }
  };
}

export function applyTradeSizingToResearchAutoTradeConfig(
  config: ResearchAutoTradeConfig,
  tradeSizing: TradeSizingSettings
): ResearchAutoTradeConfig {
  const sizing = normalizeTradeSizingSettings(tradeSizing, getDefaultTradeSizingSettings());
  return {
    ...config,
    notionalPerOrder: sizing.maxBidNotional,
    minNotionalPerOrder: sizing.minBidNotional,
    maxNotionalPerOrder: sizing.maxBidNotional
  };
}

export function normalizeTradeSizingSettings(
  input: Partial<TradeSizingSettings>,
  fallback: TradeSizingSettings = getDefaultTradeSizingSettings()
): TradeSizingSettings {
  const fallbackMin = toFiniteNumber(fallback.minBidNotional, 1);
  const fallbackMax = toFiniteNumber(fallback.maxBidNotional, fallbackMin);
  const fallbackMaxPosition = toFiniteNumber(fallback.maxPositionNotionalPerSymbol, fallbackMax);
  const minBidNotional = clampNotional(toFiniteNumber(input.minBidNotional, fallbackMin));
  const requestedMax = clampNotional(toFiniteNumber(input.maxBidNotional, fallbackMax));
  const maxBidNotional = Math.max(minBidNotional, requestedMax);
  const requestedMaxPosition = clampNotional(
    toFiniteNumber(input.maxPositionNotionalPerSymbol, fallbackMaxPosition)
  );
  const maxPositionNotionalPerSymbol = Math.max(maxBidNotional, requestedMaxPosition);

  return {
    minBidNotional,
    maxBidNotional,
    maxPositionNotionalPerSymbol
  };
}

function parseTradeSizingJson(value: string): Partial<TradeSizingSettings> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Partial<TradeSizingSettings>) : {};
  } catch {
    return {};
  }
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNotional(value: number): number {
  return Math.min(MAX_ALLOWED_BID_NOTIONAL, Math.max(1, roundCurrency(value)));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
