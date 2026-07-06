import { reconcileTrades } from "@/lib/bot/reconcile";
import { runResearchAutoTrade } from "@/lib/bot/researchAutoTrade";
import { runBotScan } from "@/lib/bot/scan";
import { getBotRuntimeConfig, getResearchAutoTradeRuntimeConfig } from "@/lib/config/env";
import { getBotEnabled } from "@/lib/db/botConfig";
import { recordPortfolioSnapshot } from "@/lib/portfolio/snapshots";

const config = getBotRuntimeConfig();
const researchAutoTradeConfig = getResearchAutoTradeRuntimeConfig();

console.log(`BranddBot worker started. Poll interval: ${config.pollIntervalSeconds}s`);
console.log(
  `Research auto-trading: ${researchAutoTradeConfig.enabled ? "enabled" : "disabled"}; max ${researchAutoTradeConfig.maxItemsPerRun} order(s)/run.`
);

while (true) {
  const enabled = await getBotEnabled().catch(() => false);

  if (enabled) {
    try {
      const beforeScan = await reconcileTrades();
      const portfolioSnapshot = await recordPortfolioSnapshot({ minIntervalSeconds: 45 })
        .then((snapshot) => ({
          portfolioValue: snapshot.portfolioValue,
          cash: snapshot.cash,
          unrealizedPnl: snapshot.unrealizedPnl,
          openPositionsCount: snapshot.openPositionsCount,
          createdAt: snapshot.createdAt
        }))
        .catch((error) => ({
          error: error instanceof Error ? error.message : "Portfolio snapshot failed."
        }));
      const researchAutoTrade = await runResearchAutoTrade({
        dryRun: false,
        config,
        researchConfig: researchAutoTradeConfig
      });
      const result = await runBotScan({ dryRun: false, config });
      const afterScan = await reconcileTrades();
      console.log(
        JSON.stringify(
          {
            finishedAt: result.finishedAt,
            reconciled: {
              beforeScan,
              afterScan
            },
            portfolioSnapshot,
            researchAutoTrade: {
              enabled: researchAutoTrade.enabled,
              submittedOrders: researchAutoTrade.submittedOrders,
              candidatesEvaluated: researchAutoTrade.candidatesEvaluated,
              items: researchAutoTrade.items.map((item) => ({
                symbol: item.symbol,
                action: item.action,
                accepted: item.accepted,
                reasons: item.reasons
              }))
            },
            symbols: result.symbols.map((symbol) => ({
              symbol: symbol.symbol,
              action: symbol.riskGate.finalAction,
              accepted: symbol.riskGate.accepted
            }))
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Worker scan failed.");
    }
  }

  await sleep(config.pollIntervalSeconds * 1000);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
