import { reconcileTrades } from "@/lib/bot/reconcile";

const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
const days = daysArg ? Number(daysArg.replace("--days=", "")) : 10;
const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * (Number.isFinite(days) ? days : 10));

const result = await reconcileTrades({ since });

console.log(JSON.stringify(result, null, 2));
