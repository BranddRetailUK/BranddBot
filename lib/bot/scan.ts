import { AIReasoningService } from "@/lib/ai/reasoning";
import { AlpacaBroker } from "@/lib/broker/alpaca";
import type { BrokerAdapter } from "@/lib/broker/types";
import { getBotRuntimeConfig } from "@/lib/config/env";
import { createPrismaScanPersistence, type ScanPersistence } from "@/lib/bot/persistence";
import { evaluateRiskGate } from "@/lib/bot/risk";
import { createRsiSignal, summarizeBars } from "@/lib/strategy/rsi";
import type { BotRuntimeConfig, ScanResult, TradingContext } from "@/lib/types/trading";

export async function runBotScan(options?: {
  dryRun?: boolean;
  broker?: BrokerAdapter;
  aiService?: AIReasoningService;
  persistence?: ScanPersistence;
  config?: BotRuntimeConfig;
}): Promise<ScanResult> {
  const startedAt = new Date();
  const dryRun = options?.dryRun ?? true;
  const config = options?.config ?? getBotRuntimeConfig();
  const broker = options?.broker ?? new AlpacaBroker();
  const aiService = options?.aiService ?? new AIReasoningService();
  const persistence = options?.persistence ?? createPrismaScanPersistence();

  const [account, positions, realizedPnlToday, barsBySymbol] = await Promise.all([
    broker.getAccount(),
    broker.getPositions(),
    persistence.getRealizedPnlToday(),
    broker.getBars(config.watchlist, config.timeframe, Math.max(config.rsiPeriod + 40, 60))
  ]);

  const results = [];

  for (const symbol of config.watchlist) {
    const bars = barsBySymbol[symbol] ?? [];
    const currentPrice = bars.at(-1)?.close ?? 0;
    const signal = createRsiSignal({
      symbol,
      bars,
      period: config.rsiPeriod,
      oversoldThreshold: config.oversoldThreshold,
      overboughtThreshold: config.overboughtThreshold,
      maxNotionalPerOrder: config.risk.maxNotionalPerOrder
    });
    const position = positions.find((item) => item.symbol === symbol);
    const [recentTrades, priorLessons] = await Promise.all([
      persistence.getRecentTrades(symbol),
      persistence.getPriorLessons(symbol)
    ]);

    await persistence.recordMarketSnapshot({
      symbol,
      timeframe: config.timeframe,
      price: currentPrice,
      rsi: signal.rsi,
      bars
    });
    await persistence.recordSignal(signal);

    const context: TradingContext = {
      symbol,
      generatedAt: new Date().toISOString(),
      currentPrice,
      barSummary: {
        timeframe: config.timeframe,
        ...summarizeBars(bars)
      },
      rsi: {
        period: config.rsiPeriod,
        current: signal.rsi,
        previous: signal.previousRsi,
        oversoldThreshold: config.oversoldThreshold,
        overboughtThreshold: config.overboughtThreshold
      },
      deterministicSignal: signal,
      position,
      account,
      openPositionsCount: positions.length,
      recentTrades,
      realizedPnlToday,
      riskLimits: config.risk,
      priorLessons
    };

    const aiDecision = await aiService.reason(context);
    const riskGate = evaluateRiskGate({ signal, aiDecision, context, config, dryRun });
    const order =
      riskGate.accepted && riskGate.order && !dryRun ? await broker.submitOrder(riskGate.order) : undefined;

    if (order) {
      await persistence.recordTrade({ order, rationale: aiDecision.rationale });
    }

    await persistence.recordAiAudit({
      symbol,
      aiDecision,
      riskGate,
      tradeOutcome: order
    });

    results.push({
      symbol,
      signal,
      aiDecision,
      riskGate,
      order
    });
  }

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    dryRun,
    tradingMode: config.tradingMode,
    symbols: results
  };
}
