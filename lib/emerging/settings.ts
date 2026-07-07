import { prisma } from "@/lib/db/prisma";
import type { EmergingResearchSettings } from "@/lib/types/trading";

export const EMERGING_SETTINGS_KEY = "emerging.settings";

const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/;
const MAX_ALLOWED_NOTIONAL = 100_000;

export function getDefaultEmergingSettings(): EmergingResearchSettings {
  return {
    enabled: true,
    seedSymbols: [],
    maxSymbols: 12,
    newsLookbackHours: 168,
    newsLimit: 50,
    minOpportunityConfidence: 0.35,
    minPrice: 1,
    maxPrice: 75,
    minAvgDailyVolume: 100_000,
    maxMarketCapUsd: 20_000_000_000,
    maxIpoAgeDays: 730,
    maxBidNotional: 10,
    maxPositionNotionalPerSymbol: 50
  };
}

export async function getEmergingSettings(): Promise<EmergingResearchSettings> {
  const defaults = getDefaultEmergingSettings();
  const row = await prisma.botConfig.findUnique({ where: { key: EMERGING_SETTINGS_KEY } }).catch(() => null);
  if (!row) return defaults;

  return {
    ...normalizeEmergingSettings(parseSettingsJson(row.value), defaults),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function setEmergingSettings(input: Partial<EmergingResearchSettings>): Promise<EmergingResearchSettings> {
  const normalized = normalizeEmergingSettings(input, await getEmergingSettings().catch(() => getDefaultEmergingSettings()));
  const row = await prisma.botConfig.upsert({
    where: { key: EMERGING_SETTINGS_KEY },
    update: { value: JSON.stringify(stripUpdatedAt(normalized)) },
    create: { key: EMERGING_SETTINGS_KEY, value: JSON.stringify(stripUpdatedAt(normalized)) }
  });

  return {
    ...normalized,
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function addEmergingSymbols(symbols: string[]): Promise<EmergingResearchSettings> {
  const settings = await getEmergingSettings();
  return setEmergingSettings({
    ...settings,
    seedSymbols: normalizeSymbols([...settings.seedSymbols, ...symbols]).slice(0, settings.maxSymbols)
  });
}

export function normalizeEmergingSettings(
  input: Partial<EmergingResearchSettings>,
  fallback: EmergingResearchSettings = getDefaultEmergingSettings()
): EmergingResearchSettings {
  const minPrice = clampCurrency(toFiniteNumber(input.minPrice, fallback.minPrice));
  const maxPrice = Math.max(minPrice, clampCurrency(toFiniteNumber(input.maxPrice, fallback.maxPrice)));
  const maxBidNotional = clampCurrency(toFiniteNumber(input.maxBidNotional, fallback.maxBidNotional));
  const maxPositionNotionalPerSymbol = Math.max(
    maxBidNotional,
    clampCurrency(toFiniteNumber(input.maxPositionNotionalPerSymbol, fallback.maxPositionNotionalPerSymbol))
  );

  return {
    enabled: input.enabled ?? fallback.enabled,
    seedSymbols: normalizeSymbols(input.seedSymbols ?? fallback.seedSymbols).slice(
      0,
      clampInteger(toFiniteNumber(input.maxSymbols, fallback.maxSymbols), 1, 50)
    ),
    maxSymbols: clampInteger(toFiniteNumber(input.maxSymbols, fallback.maxSymbols), 1, 50),
    newsLookbackHours: clampInteger(toFiniteNumber(input.newsLookbackHours, fallback.newsLookbackHours), 1, 720),
    newsLimit: clampInteger(toFiniteNumber(input.newsLimit, fallback.newsLimit), 1, 50),
    minOpportunityConfidence: clampNumber(
      toFiniteNumber(input.minOpportunityConfidence, fallback.minOpportunityConfidence),
      0,
      1
    ),
    minPrice,
    maxPrice,
    minAvgDailyVolume: clampInteger(toFiniteNumber(input.minAvgDailyVolume, fallback.minAvgDailyVolume), 0, 100_000_000),
    maxMarketCapUsd: clampInteger(toFiniteNumber(input.maxMarketCapUsd, fallback.maxMarketCapUsd), 1_000_000, 1_000_000_000_000),
    maxIpoAgeDays: clampInteger(toFiniteNumber(input.maxIpoAgeDays, fallback.maxIpoAgeDays), 1, 3650),
    maxBidNotional,
    maxPositionNotionalPerSymbol
  };
}

export function normalizeEmergingSymbol(symbol: string): string | undefined {
  const normalized = symbol.trim().toUpperCase();
  return SYMBOL_PATTERN.test(normalized) ? normalized : undefined;
}

function normalizeSymbols(symbols: unknown): string[] {
  if (!Array.isArray(symbols)) return [];
  return [
    ...new Set(
      symbols.map((symbol) => normalizeEmergingSymbol(String(symbol))).filter((symbol): symbol is string => Boolean(symbol))
    )
  ].sort((left, right) => left.localeCompare(right));
}

function parseSettingsJson(value: string): Partial<EmergingResearchSettings> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Partial<EmergingResearchSettings>)
      : {};
  } catch {
    return {};
  }
}

function stripUpdatedAt(settings: EmergingResearchSettings): Omit<EmergingResearchSettings, "updatedAt"> {
  return {
    enabled: settings.enabled,
    seedSymbols: settings.seedSymbols,
    maxSymbols: settings.maxSymbols,
    newsLookbackHours: settings.newsLookbackHours,
    newsLimit: settings.newsLimit,
    minOpportunityConfidence: settings.minOpportunityConfidence,
    minPrice: settings.minPrice,
    maxPrice: settings.maxPrice,
    minAvgDailyVolume: settings.minAvgDailyVolume,
    maxMarketCapUsd: settings.maxMarketCapUsd,
    maxIpoAgeDays: settings.maxIpoAgeDays,
    maxBidNotional: settings.maxBidNotional,
    maxPositionNotionalPerSymbol: settings.maxPositionNotionalPerSymbol
  };
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampCurrency(value: number): number {
  return Math.min(MAX_ALLOWED_NOTIONAL, Math.max(1, Math.round(value * 100) / 100));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
