import { RSI } from "technicalindicators";
import type { MarketBar, RsiSignal } from "@/lib/types/trading";

export function calculateRsi(values: number[], period: number): number[] {
  if (values.length <= period) return [];
  return RSI.calculate({ values, period });
}

export function summarizeBars(bars: MarketBar[]) {
  if (bars.length === 0) {
    return {
      count: 0
    };
  }

  const closes = bars.map((bar) => bar.close);
  const highs = bars.map((bar) => bar.high);
  const lows = bars.map((bar) => bar.low);
  const volumes = bars.map((bar) => bar.volume);

  return {
    count: bars.length,
    firstClose: closes[0],
    lastClose: closes[closes.length - 1],
    high: Math.max(...highs),
    low: Math.min(...lows),
    volume: volumes.reduce((sum, volume) => sum + volume, 0)
  };
}

export function createRsiSignal(params: {
  symbol: string;
  bars: MarketBar[];
  period: number;
  oversoldThreshold: number;
  overboughtThreshold: number;
  maxNotionalPerOrder: number;
}): RsiSignal {
  const closes = params.bars.map((bar) => bar.close);
  const rsiValues = calculateRsi(closes, params.period);
  const currentRsi = rsiValues.at(-1);
  const previousRsi = rsiValues.at(-2);

  if (currentRsi === undefined) {
    return {
      symbol: params.symbol,
      action: "hold",
      confidence: 0,
      reason: `Need more bars to calculate RSI(${params.period}).`,
      recommendedNotional: 0
    };
  }

  const recoveredFromOversold =
    previousRsi !== undefined &&
    previousRsi < params.oversoldThreshold &&
    currentRsi >= params.oversoldThreshold;
  const currentlyOversold = currentRsi <= params.oversoldThreshold;
  const overbought = currentRsi >= params.overboughtThreshold;

  if (recoveredFromOversold || currentlyOversold) {
    const distance = Math.max(0, params.oversoldThreshold - Math.min(currentRsi, params.oversoldThreshold));
    const confidence = Math.min(0.9, 0.58 + distance / 100 + (recoveredFromOversold ? 0.12 : 0));
    return {
      symbol: params.symbol,
      action: "buy",
      rsi: currentRsi,
      previousRsi,
      confidence,
      reason: recoveredFromOversold
        ? `RSI recovered from oversold: ${formatRsi(previousRsi)} -> ${formatRsi(currentRsi)}.`
        : `RSI is oversold at ${formatRsi(currentRsi)}.`,
      recommendedNotional: params.maxNotionalPerOrder
    };
  }

  if (overbought) {
    const confidence = Math.min(0.92, 0.6 + (currentRsi - params.overboughtThreshold) / 100);
    return {
      symbol: params.symbol,
      action: "sell",
      rsi: currentRsi,
      previousRsi,
      confidence,
      reason: `RSI is overbought at ${formatRsi(currentRsi)}.`,
      recommendedNotional: params.maxNotionalPerOrder
    };
  }

  return {
    symbol: params.symbol,
    action: "hold",
    rsi: currentRsi,
    previousRsi,
    confidence: 0.5,
    reason: `RSI ${formatRsi(currentRsi)} is between configured thresholds.`,
    recommendedNotional: 0
  };
}

function formatRsi(value?: number): string {
  return value === undefined ? "n/a" : value.toFixed(2);
}
