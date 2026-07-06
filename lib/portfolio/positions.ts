import { AlpacaBroker } from "@/lib/broker/alpaca";
import type { BrokerAdapter } from "@/lib/broker/types";
import type { PortfolioPositionsResult, PositionSnapshot } from "@/lib/types/trading";

export async function getPortfolioPositions(options?: {
  broker?: Pick<BrokerAdapter, "getPositions">;
  now?: Date;
}): Promise<PortfolioPositionsResult> {
  const now = options?.now ?? new Date();
  const broker = options?.broker ?? new AlpacaBroker();
  const positions = await broker.getPositions();
  const longPositions = positions.filter(hasLongPosition);
  const totalMarketValue = sum(longPositions.map((position) => Math.max(0, position.marketValue)));

  return {
    generatedAt: now.toISOString(),
    totalMarketValue,
    positions: longPositions
      .map((position) => ({
        symbol: position.symbol,
        qty: position.qty,
        marketValue: position.marketValue,
        avgEntryPrice: position.avgEntryPrice,
        unrealizedPnl: position.unrealizedPnl,
        allocationPercent: totalMarketValue > 0 ? position.marketValue / totalMarketValue : 0
      }))
      .sort((left, right) => right.marketValue - left.marketValue)
  };
}

function hasLongPosition(position: PositionSnapshot): boolean {
  return position.qty > 0 || position.marketValue > 0;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
