import { prisma } from "@/lib/db/prisma";
import type {
  AiDecisionResult,
  MarketBar,
  OrderResult,
  RecentTradeSummary,
  RiskGateResult,
  RsiSignal
} from "@/lib/types/trading";

export interface ScanPersistence {
  getRecentTrades(symbol: string): Promise<RecentTradeSummary[]>;
  getPriorLessons(symbol: string): Promise<string[]>;
  getRealizedPnlToday(): Promise<number>;
  recordMarketSnapshot(params: { symbol: string; timeframe: string; price: number; rsi?: number; bars: MarketBar[] }): Promise<void>;
  recordSignal(signal: RsiSignal): Promise<void>;
  recordAiAudit(params: {
    symbol: string;
    aiDecision: AiDecisionResult;
    riskGate: RiskGateResult;
    tradeOutcome?: OrderResult;
  }): Promise<void>;
  recordTrade(params: { order: OrderResult; rationale: string }): Promise<void>;
}

export function createPrismaScanPersistence(): ScanPersistence {
  return {
    async getRecentTrades(symbol) {
      const rows = await prisma.trade.findMany({
        where: { symbol },
        orderBy: { createdAt: "desc" },
        take: 8
      });

      return rows.map((row) => ({
        symbol: row.symbol,
        side: row.side,
        notional: row.notional ?? undefined,
        realizedPnl: row.realizedPnl ?? undefined,
        status: row.status,
        createdAt: row.createdAt.toISOString()
      }));
    },

    async getPriorLessons(symbol) {
      const rows = await prisma.learningEvent.findMany({
        where: { symbol },
        orderBy: { createdAt: "desc" },
        take: 8
      });
      return rows.map((row) => row.summary);
    },

    async getRealizedPnlToday() {
      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      const rows = await prisma.trade.findMany({
        where: {
          createdAt: { gte: since },
          realizedPnl: { not: null }
        }
      });
      return rows.reduce((sum, row) => sum + (row.realizedPnl ?? 0), 0);
    },

    async recordMarketSnapshot(params) {
      await prisma.marketSnapshot.create({
        data: {
          symbol: params.symbol,
          timeframe: params.timeframe,
          price: params.price,
          rsi: params.rsi,
          barsJson: JSON.stringify(params.bars)
        }
      });
    },

    async recordSignal(signal) {
      await prisma.signal.create({
        data: {
          symbol: signal.symbol,
          action: signal.action,
          confidence: signal.confidence,
          rsi: signal.rsi,
          reason: signal.reason,
          recommendedNotional: signal.recommendedNotional
        }
      });
    },

    async recordAiAudit(params) {
      await prisma.aiAudit.create({
        data: {
          symbol: params.symbol,
          promptHash: params.aiDecision.promptHash,
          inputJson: params.aiDecision.inputJson,
          outputJson: params.aiDecision.outputJson,
          decision: params.aiDecision.decision,
          confidence: params.aiDecision.confidence,
          rationale: params.aiDecision.rationale,
          riskFlagsJson: JSON.stringify(params.aiDecision.riskFlags),
          learningUpdateJson: JSON.stringify(params.aiDecision.learningUpdate),
          recommendedAdjustmentsJson: JSON.stringify(params.aiDecision.recommendedParameterAdjustments),
          accepted: params.riskGate.accepted,
          rejectionReasonsJson: JSON.stringify(params.riskGate.reasons),
          tradeOutcomeJson: params.tradeOutcome ? JSON.stringify(params.tradeOutcome) : undefined,
          openAiResponseId: params.aiDecision.openAiResponseId
        }
      });

      if (params.aiDecision.learningUpdate.summary.trim()) {
        await prisma.learningEvent.create({
          data: {
            symbol: params.symbol,
            reward: params.aiDecision.learningUpdate.rewardSignal,
            summary: params.aiDecision.learningUpdate.summary,
            source: "openai"
          }
        });
      }
    },

    async recordTrade(params) {
      await prisma.trade.create({
        data: {
          symbol: params.order.symbol,
          side: params.order.side,
          qty: params.order.qty,
          notional: params.order.notional,
          price: params.order.filledAvgPrice,
          orderId: params.order.id,
          status: params.order.status,
          rationale: params.rationale
        }
      });
    }
  };
}

export function createNoopScanPersistence(): ScanPersistence {
  return {
    async getRecentTrades() {
      return [];
    },
    async getPriorLessons() {
      return [];
    },
    async getRealizedPnlToday() {
      return 0;
    },
    async recordMarketSnapshot() {},
    async recordSignal() {},
    async recordAiAudit() {},
    async recordTrade() {}
  };
}
