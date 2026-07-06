import { AlpacaBroker } from "@/lib/broker/alpaca";
import type { BrokerAdapter } from "@/lib/broker/types";
import { getBotRuntimeConfig } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import { getStockAsset } from "@/lib/market/assets";
import type { BotRuntimeConfig, OrderResult, StockAsset } from "@/lib/types/trading";

const MAX_MANUAL_PAPER_BUY_NOTIONAL = 100_000;

export async function submitManualPaperBuy(options: {
  symbol: string;
  notional: number;
  broker?: BrokerAdapter;
  config?: BotRuntimeConfig;
  asset?: StockAsset;
  persist?: boolean;
}): Promise<OrderResult> {
  const symbol = options.symbol.trim().toUpperCase();
  const notional = roundCurrency(options.notional);
  const config = options.config ?? getBotRuntimeConfig();

  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) {
    throw new Error("Symbol must be 1-10 letters/numbers and may include . or -.");
  }
  if (!Number.isFinite(notional) || notional < 1) {
    throw new Error("Manual paper buy notional must be at least $1.");
  }
  if (notional > MAX_MANUAL_PAPER_BUY_NOTIONAL) {
    throw new Error("Manual paper buy notional cannot exceed the $100,000 paper account size.");
  }
  if (config.tradingMode !== "paper" || config.liveTradingEnabled || !config.paperTradingEndpoint) {
    throw new Error("Manual buys require paper mode, live trading disabled, and an Alpaca paper endpoint.");
  }

  const broker = options.broker ?? new AlpacaBroker();
  const [asset, account] = await Promise.all([options.asset ? Promise.resolve(options.asset) : getStockAsset(symbol), broker.getAccount()]);

  if (!asset) {
    throw new Error(`${symbol} was not found in Alpaca active US equity assets.`);
  }
  if (asset.symbol !== symbol) {
    throw new Error(`Asset lookup returned ${asset.symbol}, not ${symbol}.`);
  }
  if (!asset.tradable) {
    throw new Error(`${symbol} is not currently marked tradable by Alpaca.`);
  }
  if (!asset.fractionable) {
    throw new Error(`${symbol} is not fractionable, so notional paper buys are not supported from this screen.`);
  }
  if (notional > account.buyingPower) {
    throw new Error(`Manual buy exceeds available paper buying power of $${account.buyingPower.toFixed(2)}.`);
  }

  const orderRequest = {
    symbol,
    side: "buy" as const,
    notional,
    type: "market" as const,
    timeInForce: "day" as const,
    clientOrderId: `bb-manual-${symbol.toLowerCase()}-${Date.now()}`
  };
  const order = await broker.submitOrder(orderRequest);

  if (options.persist ?? true) {
    await prisma.$transaction([
      prisma.trade.create({
        data: {
          symbol: order.symbol,
          side: order.side,
          strategy: "manual",
          qty: order.qty,
          notional: order.notional ?? notional,
          price: order.filledAvgPrice,
          orderId: order.id,
          status: order.status,
          rationale: `[manual] User-submitted paper buy for ${asset.name}.`,
          tradeOutcomeJson: JSON.stringify({
            source: "manual_order",
            asset,
            orderRequest
          })
        }
      }),
      prisma.learningEvent.create({
        data: {
          symbol: order.symbol,
          reward: 0,
          summary: `${order.symbol} manual paper buy submitted by user. Outcome learning will update after reconciliation closes the trade.`,
          source: "manual_order"
        }
      })
    ]);
  }

  return order;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
