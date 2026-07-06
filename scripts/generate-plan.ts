import { buildTradePlan } from "@/lib/plan/builder";

const maxItemsArg = process.argv.find((arg) => arg.startsWith("--max-items="));

const plan = await buildTradePlan({
  maxItems: parseOptionalNumber(maxItemsArg, "--max-items=")
});

console.log(JSON.stringify(plan, null, 2));

function parseOptionalNumber(arg: string | undefined, prefix: string): number | undefined {
  if (!arg) return undefined;
  const parsed = Number(arg.replace(prefix, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}
