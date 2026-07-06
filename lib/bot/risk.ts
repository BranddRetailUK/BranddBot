import type {
  AiDecisionResult,
  BotRuntimeConfig,
  PositionSnapshot,
  RiskGateResult,
  RsiSignal,
  TradingContext
} from "@/lib/types/trading";

export function evaluateRiskGate(params: {
  signal: RsiSignal;
  aiDecision: AiDecisionResult;
  context: TradingContext;
  config: BotRuntimeConfig;
  dryRun: boolean;
}): RiskGateResult {
  const { signal, aiDecision, context, config } = params;
  const reasons: string[] = [];

  if (config.tradingMode !== "paper" || config.liveTradingEnabled) {
    reasons.push("Live trading is disabled in this scaffold; only paper mode can submit orders.");
  }

  if (!config.watchlist.includes(signal.symbol)) {
    reasons.push(`${signal.symbol} is not in the configured watchlist.`);
  }

  if (!aiDecision.configured) {
    reasons.push("OpenAI API key is not configured, so AI-gated execution is blocked.");
  }

  if (context.realizedPnlToday <= -config.risk.maxDailyLossUsd) {
    reasons.push(`Daily loss limit reached: ${context.realizedPnlToday.toFixed(2)} USD.`);
  }

  if (context.openPositionsCount >= config.risk.maxOpenPositions && signal.action === "buy" && !context.position) {
    reasons.push(`Max open positions reached: ${config.risk.maxOpenPositions}.`);
  }

  if (aiDecision.decision === "block") {
    reasons.push(`OpenAI blocked the trade: ${aiDecision.rationale}`);
  }

  if (aiDecision.confidence < config.risk.minAiConfidence && signal.action !== "hold") {
    reasons.push(
      `OpenAI confidence ${aiDecision.confidence.toFixed(2)} is below ${config.risk.minAiConfidence.toFixed(2)}.`
    );
  }

  if (signal.action === "hold") {
    return {
      accepted: false,
      finalAction: "hold",
      reasons: [...reasons, "Deterministic RSI signal is hold."]
    };
  }

  if (!isAiAlignedWithSignal(aiDecision.decision, signal.action)) {
    return {
      accepted: false,
      finalAction: "hold",
      reasons: [...reasons, `OpenAI decision ${aiDecision.decision} does not align with RSI ${signal.action}.`]
    };
  }

  if (signal.action === "sell" && !hasLongPosition(context.position)) {
    reasons.push("Sell signal ignored because no long position exists.");
  }

  const notional = calculateAllowedNotional(context.position, config, signal.recommendedNotional ?? 0);
  if (signal.action === "buy" && notional <= 0) {
    reasons.push("No notional capacity remains for this symbol.");
  }

  if (reasons.length > 0) {
    return {
      accepted: false,
      finalAction: reasons.some((reason) => reason.includes("blocked")) ? "block" : "hold",
      reasons
    };
  }

  if (signal.action === "buy") {
    return {
      accepted: true,
      finalAction: "buy",
      reasons: ["Accepted by RSI, OpenAI, and risk gates."],
      order: {
        symbol: signal.symbol,
        side: "buy",
        notional,
        type: "market",
        timeInForce: "day",
        clientOrderId: createClientOrderId(signal.symbol)
      }
    };
  }

  return {
    accepted: true,
    finalAction: "sell",
    reasons: ["Accepted by RSI, OpenAI, and risk gates."],
    order: {
      symbol: signal.symbol,
      side: "sell",
      qty: context.position?.qty,
      type: "market",
      timeInForce: "day",
      clientOrderId: createClientOrderId(signal.symbol)
    }
  };
}

function isAiAlignedWithSignal(aiDecision: string, action: string): boolean {
  return aiDecision === action;
}

function hasLongPosition(position?: PositionSnapshot): boolean {
  return Boolean(position && position.qty > 0);
}

function calculateAllowedNotional(
  position: PositionSnapshot | undefined,
  config: BotRuntimeConfig,
  recommendedNotional: number
): number {
  const currentExposure = position?.marketValue ?? 0;
  const remainingForSymbol = config.risk.maxPositionNotionalPerSymbol - currentExposure;
  return Math.max(0, Math.min(config.risk.maxNotionalPerOrder, recommendedNotional, remainingForSymbol));
}

function createClientOrderId(symbol: string): string {
  return `branddbot-${symbol.toLowerCase()}-${Date.now()}`;
}
