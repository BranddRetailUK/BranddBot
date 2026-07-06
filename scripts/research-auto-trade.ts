import { runResearchAutoTrade } from "@/lib/bot/researchAutoTrade";

const dryRun = process.argv.includes("--dry-run");

const result = await runResearchAutoTrade({ dryRun });
console.log(JSON.stringify(result, null, 2));
