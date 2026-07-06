import { AlpacaBroker } from "@/lib/broker/alpaca";
import type { BrokerAdapter } from "@/lib/broker/types";
import { prisma } from "@/lib/db/prisma";
import type { BrokerOrderSnapshot, ReconcileResult } from "@/lib/types/trading";

const FILLED_STATUSES = new Set(["filled", "partially_filled"]);
const TERMINAL_STATUSES = new Set(["filled", "canceled", "expired", "rejected"]);

export async function reconcileTrades(options?: {
  broker?: BrokerAdapter;
  since?: Date;
  createLearningEvents?: boolean;
}): Promise<ReconcileResult> {
  const startedAt = new Date();
  const broker = options?.broker ?? new AlpacaBroker();
  const createLearningEvents = options?.createLearningEvents ?? true;
  const since = options?.since ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);

  const trades = await prisma.trade.findMany({
    where: {
      orderId: { not: null },
      createdAt: { gte: since },
      OR: [
        { reconciledAt: null },
        { status: { notIn: Array.from(TERMINAL_STATUSES) } },
        { qty: null },
        { price: null },
        { side: "sell", realizedPnl: null }
      ]
    },
    orderBy: { createdAt: "asc" },
    take: 200
  });

  let updatedOrders = 0;
  let closedTrades = 0;
  let learningEvents = 0;

  for (const trade of trades) {
    if (!trade.orderId) continue;

    const order = await broker.getOrder(trade.orderId);
    const filledAt = parseDate(order.filledAt);
    const nextData = orderToTradeUpdate(order, filledAt);

    const updated = await prisma.trade.update({
      where: { id: trade.id },
      data: nextData
    });
    updatedOrders += 1;

    if (updated.side === "sell" && FILLED_STATUSES.has(updated.status) && updated.realizedPnl === null) {
      const outcome = await closeSellTrade({
        sellTradeId: updated.id,
        symbol: updated.symbol,
        sellQty: updated.qty ?? 0,
        sellPrice: updated.price ?? 0,
        closedAt: updated.filledAt ?? filledAt ?? new Date(),
        createLearningEvents
      });
      closedTrades += outcome.closedTrades;
      learningEvents += outcome.learningEvents;
    }
  }

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    checkedTrades: trades.length,
    updatedOrders,
    closedTrades,
    learningEvents
  };
}

function orderToTradeUpdate(order: BrokerOrderSnapshot, filledAt?: Date) {
  const tradeOutcomeJson = {
    orderId: order.id,
    status: order.status,
    qty: order.qty,
    filledAvgPrice: order.filledAvgPrice,
    filledAt: order.filledAt,
    reconciledAt: new Date().toISOString()
  };

  return {
    status: order.status,
    qty: order.qty,
    notional: order.notional,
    price: order.filledAvgPrice,
    filledAt,
    reconciledAt: new Date(),
    tradeOutcomeJson: JSON.stringify(tradeOutcomeJson)
  };
}

async function closeSellTrade(params: {
  sellTradeId: string;
  symbol: string;
  sellQty: number;
  sellPrice: number;
  closedAt: Date;
  createLearningEvents: boolean;
}) {
  if (params.sellQty <= 0 || params.sellPrice <= 0) {
    await prisma.trade.update({
      where: { id: params.sellTradeId },
      data: {
        closedAt: params.closedAt,
        tradeOutcomeJson: JSON.stringify({
          outcome: "unmatched",
          reason: "Sell fill did not include positive qty and price."
        })
      }
    });
    return { closedTrades: 0, learningEvents: 0 };
  }

  const openBuys = await prisma.trade.findMany({
    where: {
      symbol: params.symbol,
      side: "buy",
      status: { in: Array.from(FILLED_STATUSES) },
      closedAt: null,
      qty: { not: null },
      price: { not: null },
      createdAt: { lt: params.closedAt }
    },
    orderBy: { createdAt: "asc" }
  });

  let remainingSellQty = params.sellQty;
  let realizedPnl = 0;
  const matches: Array<{ buyTradeId: string; qty: number; entryPrice: number; exitPrice: number; pnl: number }> = [];

  for (const buy of openBuys) {
    if (remainingSellQty <= 0) break;
    const buyQty = buy.qty ?? 0;
    const buyPrice = buy.price ?? 0;
    if (buyQty <= 0 || buyPrice <= 0) continue;

    const matchedQty = Math.min(remainingSellQty, buyQty);
    const pnl = (params.sellPrice - buyPrice) * matchedQty;
    realizedPnl += pnl;
    remainingSellQty -= matchedQty;
    matches.push({
      buyTradeId: buy.id,
      qty: matchedQty,
      entryPrice: buyPrice,
      exitPrice: params.sellPrice,
      pnl
    });
  }

  const outcomeJson = JSON.stringify({
    outcome: matches.length > 0 ? "closed" : "unmatched",
    symbol: params.symbol,
    sellQty: params.sellQty,
    sellPrice: params.sellPrice,
    realizedPnl,
    remainingSellQty,
    matches
  });

  await prisma.$transaction([
    prisma.trade.update({
      where: { id: params.sellTradeId },
      data: {
        realizedPnl,
        closedAt: params.closedAt,
        tradeOutcomeJson: outcomeJson
      }
    }),
    ...matches.map((match) =>
      prisma.trade.update({
        where: { id: match.buyTradeId },
        data: {
          closedAt: params.closedAt,
          realizedPnl: match.pnl,
          tradeOutcomeJson: JSON.stringify({
            outcome: "closed_by_sell",
            sellTradeId: params.sellTradeId,
            qty: match.qty,
            entryPrice: match.entryPrice,
            exitPrice: match.exitPrice,
            realizedPnl: match.pnl
          })
        }
      })
    )
  ]);

  let learningEvents = 0;
  if (params.createLearningEvents && matches.length > 0) {
    await prisma.learningEvent.create({
      data: {
        symbol: params.symbol,
        reward: pnlToReward(realizedPnl, params.sellQty * params.sellPrice),
        summary: `${params.symbol} paper trade closed with ${formatUsd(realizedPnl)} realized PnL after matching ${matches.length} entry order(s).`,
        source: "alpaca_reconciliation"
      }
    });
    learningEvents = 1;
  }

  return { closedTrades: matches.length > 0 ? 1 : 0, learningEvents };
}

function pnlToReward(realizedPnl: number, notional: number): number {
  if (notional <= 0) return 0;
  return Math.max(-1, Math.min(1, realizedPnl / notional));
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatUsd(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}
