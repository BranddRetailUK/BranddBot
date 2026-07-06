import { prisma } from "@/lib/db/prisma";

export const FOCUS_SYMBOLS_KEY = "research.focusSymbols";

const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/;

export async function getFocusedSymbols(): Promise<string[]> {
  const row = await prisma.botConfig.findUnique({ where: { key: FOCUS_SYMBOLS_KEY } });
  return normalizeFocusedSymbols(parseSymbolsJson(row?.value));
}

export async function setFocusedSymbols(symbols: string[]): Promise<string[]> {
  const normalized = normalizeFocusedSymbols(symbols);
  await prisma.botConfig.upsert({
    where: { key: FOCUS_SYMBOLS_KEY },
    update: { value: JSON.stringify(normalized) },
    create: { key: FOCUS_SYMBOLS_KEY, value: JSON.stringify(normalized) }
  });
  return normalized;
}

export async function setSymbolFocused(symbol: string, focused: boolean): Promise<string[]> {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) {
    throw new Error("Symbol must be 1-10 letters/numbers and may include . or -.");
  }

  const current = await getFocusedSymbols();
  const next = focused ? [...current, normalizedSymbol] : current.filter((item) => item !== normalizedSymbol);
  return setFocusedSymbols(next);
}

export function normalizeFocusedSymbols(symbols: unknown): string[] {
  if (!Array.isArray(symbols)) return [];
  return [...new Set(symbols.map((symbol) => normalizeSymbol(String(symbol))).filter((symbol): symbol is string => Boolean(symbol)))]
    .sort((left, right) => left.localeCompare(right));
}

export function normalizeSymbol(symbol: string): string | undefined {
  const normalized = symbol.trim().toUpperCase();
  return SYMBOL_PATTERN.test(normalized) ? normalized : undefined;
}

function parseSymbolsJson(value?: string): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
