import { runBotScan } from "@/lib/bot/scan";
import { getBotRuntimeConfig } from "@/lib/config/env";
import { getBotEnabled } from "@/lib/db/botConfig";

const config = getBotRuntimeConfig();

console.log(`BranddBot worker started. Poll interval: ${config.pollIntervalSeconds}s`);

while (true) {
  const enabled = await getBotEnabled().catch(() => false);

  if (enabled) {
    try {
      const result = await runBotScan({ dryRun: false, config });
      console.log(
        JSON.stringify(
          {
            finishedAt: result.finishedAt,
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
