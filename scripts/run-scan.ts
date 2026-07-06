import { runBotScan } from "@/lib/bot/scan";

const dryRun = !process.argv.includes("--paper");
const result = await runBotScan({ dryRun });

console.log(JSON.stringify(result, null, 2));
