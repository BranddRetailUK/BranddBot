import { runResearchCrawl } from "@/lib/research/crawl";

const symbolsArg = process.argv.find((arg) => arg.startsWith("--symbols="));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const lookbackArg = process.argv.find((arg) => arg.startsWith("--lookback-hours="));

const result = await runResearchCrawl({
  symbols: symbolsArg
    ? symbolsArg
        .replace("--symbols=", "")
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean)
    : undefined,
  limit: parseOptionalNumber(limitArg, "--limit="),
  lookbackHours: parseOptionalNumber(lookbackArg, "--lookback-hours=")
});

console.log(JSON.stringify(result, null, 2));

function parseOptionalNumber(arg: string | undefined, prefix: string): number | undefined {
  if (!arg) return undefined;
  const parsed = Number(arg.replace(prefix, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}
