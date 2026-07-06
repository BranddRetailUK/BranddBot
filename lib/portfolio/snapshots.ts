import { AlpacaBroker } from "@/lib/broker/alpaca";
import type { BrokerAdapter } from "@/lib/broker/types";
import { prisma } from "@/lib/db/prisma";
import type { PortfolioHistoryResult, PortfolioSnapshotPoint, PositionSnapshot } from "@/lib/types/trading";

type PortfolioSnapshotRow = {
  id: string;
  portfolioValue: number;
  cash: number;
  buyingPower: number;
  longMarketValue: number;
  unrealizedPnl: number;
  openPositionsCount: number;
  createdAt: Date;
};

export async function recordPortfolioSnapshot(options?: {
  broker?: Pick<BrokerAdapter, "getAccount" | "getPositions">;
  minIntervalSeconds?: number;
  now?: Date;
}): Promise<PortfolioSnapshotPoint> {
  const now = options?.now ?? new Date();
  const minIntervalSeconds = Math.max(0, options?.minIntervalSeconds ?? 10);
  const latest = await prisma.portfolioSnapshot.findFirst({ orderBy: { createdAt: "desc" } });

  if (latest && now.getTime() - latest.createdAt.getTime() < minIntervalSeconds * 1000) {
    return mapSnapshot(latest);
  }

  const broker = options?.broker ?? new AlpacaBroker();
  const [account, positions] = await Promise.all([broker.getAccount(), broker.getPositions()]);
  const summary = summarizePortfolioPositions(positions);

  const created = await prisma.portfolioSnapshot.create({
    data: {
      portfolioValue: account.portfolioValue,
      cash: account.cash,
      buyingPower: account.buyingPower,
      longMarketValue: summary.longMarketValue,
      unrealizedPnl: summary.unrealizedPnl,
      openPositionsCount: summary.openPositionsCount,
      createdAt: now
    }
  });

  return mapSnapshot(created);
}

export async function getPortfolioHistory(options?: {
  broker?: Pick<BrokerAdapter, "getAccount" | "getPositions">;
  rangeHours?: number;
  refresh?: boolean;
  minIntervalSeconds?: number;
  now?: Date;
}): Promise<PortfolioHistoryResult> {
  const now = options?.now ?? new Date();
  const rangeHours = Math.max(1, Math.min(168, Math.floor(options?.rangeHours ?? 24)));
  const since = new Date(now.getTime() - rangeHours * 60 * 60 * 1000);
  let error: string | undefined;

  if (options?.refresh !== false) {
    await recordPortfolioSnapshot({
      broker: options?.broker,
      minIntervalSeconds: options?.minIntervalSeconds,
      now
    }).catch((caught) => {
      error = caught instanceof Error ? caught.message : "Portfolio snapshot refresh failed.";
    });
  }

  const rows = await prisma.portfolioSnapshot.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take: 1000
  });
  const points = rows.map(mapSnapshot);
  const latest = points.at(-1);
  const baselineValue = points[0]?.portfolioValue;
  const change = latest && baselineValue !== undefined ? latest.portfolioValue - baselineValue : undefined;
  const changePercent = change !== undefined && baselineValue && baselineValue !== 0 ? change / baselineValue : undefined;

  return {
    generatedAt: now.toISOString(),
    rangeHours,
    points,
    latest,
    baselineValue,
    change,
    changePercent,
    error
  };
}

function mapSnapshot(row: PortfolioSnapshotRow): PortfolioSnapshotPoint {
  return {
    id: row.id,
    portfolioValue: row.portfolioValue,
    cash: row.cash,
    buyingPower: row.buyingPower,
    longMarketValue: row.longMarketValue,
    unrealizedPnl: row.unrealizedPnl,
    openPositionsCount: row.openPositionsCount,
    createdAt: row.createdAt.toISOString()
  };
}

function hasLongPosition(position: PositionSnapshot): boolean {
  return position.qty > 0 || position.marketValue > 0;
}

export function summarizePortfolioPositions(positions: PositionSnapshot[]) {
  const longPositions = positions.filter(hasLongPosition);
  return {
    longMarketValue: sum(longPositions.map((position) => Math.max(0, position.marketValue))),
    unrealizedPnl: sum(positions.map((position) => position.unrealizedPnl)),
    openPositionsCount: longPositions.length
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
