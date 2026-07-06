import { Crosshair, Newspaper, ShieldAlert, TrendingUp } from "lucide-react";
import { FocusSymbolButton, FocusSymbolForm } from "@/app/dashboard/stocks/FocusStockControls";
import { StockSearchBuy } from "@/app/dashboard/stocks/StockSearchBuy";
import { getFocusedSymbols } from "@/lib/db/focusSymbols";
import { prisma } from "@/lib/db/prisma";
import { getPortfolioPositions } from "@/lib/portfolio/positions";
import { getTradeSizingSettings } from "@/lib/trading/tradeSizing";
import type { PortfolioPositionValue, TradePlanSuggestedAction } from "@/lib/types/trading";

export const dynamic = "force-dynamic";

type OpportunityRow = {
  id: string;
  symbol: string;
  direction: string;
  thesis: string;
  catalyst: string;
  confidence: number;
  score: number;
  sourceItemIdsJson: string;
  riskFlagsJson: string;
  lastSeenAt: Date;
  expiresAt: Date;
};

type ResearchItemRow = {
  id: string;
  symbol: string;
  sourceUrl: string;
  headline: string;
  sentiment: string;
  catalyst: string | null;
  confidence: number;
  publishedAt: Date;
};

type StockSummary = {
  symbol: string;
  focused: boolean;
  optimismScore: number;
  confidence: number;
  suggestedAction: TradePlanSuggestedAction;
  thesis: string;
  catalyst: string;
  adviceReason: string;
  riskNotes: string[];
  sourceUrls: string[];
  opportunityCount: number;
  latestResearchAt?: Date;
  position?: PortfolioPositionValue;
};

export default async function StocksPage() {
  const now = new Date();
  const [opportunities, researchItems, focusedSymbols, portfolioPositions, tradeSizing] = await Promise.all([
    prisma.opportunity
      .findMany({
        where: { status: "active", expiresAt: { gt: now } },
        orderBy: [{ score: "desc" }, { lastSeenAt: "desc" }],
        take: 200
      })
      .catch(() => [] as OpportunityRow[]),
    prisma.researchItem.findMany({ orderBy: { publishedAt: "desc" }, take: 300 }).catch(() => [] as ResearchItemRow[]),
    getFocusedSymbols().catch(() => []),
    getPortfolioPositions().catch(() => undefined),
    getTradeSizingSettings()
  ]);

  const sourceIds = uniqueValues(opportunities.flatMap((opportunity) => parseStringArray(opportunity.sourceItemIdsJson)));
  const extraSources =
    sourceIds.length > 0
      ? await prisma.researchItem
          .findMany({
            where: { id: { in: sourceIds } },
            select: { id: true, sourceUrl: true, headline: true, symbol: true, sentiment: true, catalyst: true, confidence: true, publishedAt: true }
          })
          .catch(() => [])
      : [];

  const summaries = buildStockSummaries({
    opportunities,
    researchItems: mergeResearchItems(researchItems, extraSources),
    focusedSymbols,
    positions: portfolioPositions?.positions ?? []
  });
  const positiveCount = summaries.filter((summary) => summary.optimismScore >= 0.25).length;
  const riskCount = summaries.filter((summary) => summary.optimismScore <= -0.25).length;

  return (
    <div className="stack">
      <section className="grid cards">
        <Metric icon={<TrendingUp size={20} />} label="Research Symbols" value={String(summaries.length)} />
        <Metric icon={<Crosshair size={20} />} label="Focused" value={String(focusedSymbols.length)} />
        <Metric icon={<Newspaper size={20} />} label="Positive Candidates" value={String(positiveCount)} />
        <Metric icon={<ShieldAlert size={20} />} label="Risk Candidates" value={String(riskCount)} />
      </section>

      <StockSearchBuy defaultNotional={tradeSizing.maxBidNotional} />

      <section className="panel">
        <div className="panelHeader stockHeader">
          <div>
            <span>Stocks</span>
            <h2>Most Optimistic Research Signals</h2>
          </div>
          <FocusSymbolForm />
        </div>
        <div className="panelBody stack">
          <p className="sectionIntro">
            This ranks every symbol the bot currently knows from active opportunities, recent research, focused symbols, and
            open paper positions. Focusing a symbol adds it to scheduled research crawls and advisory trade plans.
          </p>
          {focusedSymbols.length > 0 ? (
            <div className="badgeRow pageBadges">
              {focusedSymbols.map((symbol) => (
                <span className="badge success" key={symbol}>
                  Focused: {symbol}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="tableWrap">
          <table className="wideTable stockTable">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Symbol</th>
                <th>Focus</th>
                <th>Optimism</th>
                <th>Action</th>
                <th>Confidence</th>
                <th>Catalyst / Reason</th>
                <th>Thesis</th>
                <th>Risk Notes</th>
                <th>Sources</th>
              </tr>
            </thead>
            <tbody>
              {summaries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="muted">
                    No researched stocks yet. Run the research crawler or focus a symbol.
                  </td>
                </tr>
              ) : (
                summaries.map((summary, index) => (
                  <tr key={summary.symbol}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{summary.symbol}</strong>
                      {summary.position ? (
                        <div className="muted">{formatUsd(summary.position.marketValue)} held</div>
                      ) : null}
                    </td>
                    <td>
                      <FocusSymbolButton symbol={summary.symbol} initialFocused={summary.focused} />
                    </td>
                    <td className={scoreClass(summary.optimismScore)}>{summary.optimismScore.toFixed(3)}</td>
                    <td>
                      <span className={`planAction ${summary.suggestedAction}`}>{formatAction(summary.suggestedAction)}</span>
                      <div className="muted">{summary.adviceReason}</div>
                    </td>
                    <td>{summary.confidence.toFixed(2)}</td>
                    <td>
                      <div>{summary.catalyst}</div>
                      {summary.latestResearchAt ? <div className="muted">{summary.latestResearchAt.toLocaleString()}</div> : null}
                    </td>
                    <td>{summary.thesis}</td>
                    <td>{summary.riskNotes.join(" ")}</td>
                    <td>
                      {summary.sourceUrls.length > 0 ? (
                        <div className="sourceLinks">
                          {summary.sourceUrls.slice(0, 3).map((url, sourceIndex) => (
                            <a key={url} href={url} rel="noreferrer" target="_blank">
                              Source {sourceIndex + 1}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">No active source link</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function buildStockSummaries(params: {
  opportunities: OpportunityRow[];
  researchItems: ResearchItemRow[];
  focusedSymbols: string[];
  positions: PortfolioPositionValue[];
}): StockSummary[] {
  const symbols = uniqueSymbols([
    ...params.opportunities.map((opportunity) => opportunity.symbol),
    ...params.researchItems.map((item) => item.symbol),
    ...params.focusedSymbols,
    ...params.positions.map((position) => position.symbol)
  ]);

  return symbols
    .map((symbol) => {
      const opportunities = params.opportunities.filter((opportunity) => opportunity.symbol === symbol);
      const researchItems = params.researchItems.filter((item) => item.symbol === symbol);
      const position = params.positions.find((item) => item.symbol === symbol);
      const focused = params.focusedSymbols.includes(symbol);
      const netScore = clamp(opportunities.reduce((sum, opportunity) => sum + opportunity.score, 0), -1, 1);
      const bestOpportunity = selectBestOpportunity(opportunities);
      const latestResearchAt = latestDate([
        ...opportunities.map((opportunity) => opportunity.lastSeenAt),
        ...researchItems.map((item) => item.publishedAt)
      ]);
      const suggestedAction = chooseAction(netScore, position);
      const confidence = calculateConfidence(opportunities, researchItems, focused);
      const sourceUrls = uniqueValues([
        ...researchItems.map((item) => item.sourceUrl),
        ...opportunities.flatMap((opportunity) => {
          const ids = parseStringArray(opportunity.sourceItemIdsJson);
          return ids.flatMap((id) => researchItems.filter((item) => item.id === id).map((item) => item.sourceUrl));
        })
      ]);
      const riskNotes = buildRiskNotes({ symbol, opportunities, focused, position });

      return {
        symbol,
        focused,
        optimismScore: Number(netScore.toFixed(4)),
        confidence,
        suggestedAction,
        thesis: buildThesis({ symbol, bestOpportunity, researchItems, focused, suggestedAction }),
        catalyst: buildCatalyst({ bestOpportunity, researchItems, focused }),
        adviceReason: buildAdviceReason({ suggestedAction, opportunityCount: opportunities.length, focused, position }),
        riskNotes,
        sourceUrls,
        opportunityCount: opportunities.length,
        latestResearchAt,
        position
      };
    })
    .sort((left, right) => {
      const scoreDiff = right.optimismScore - left.optimismScore;
      if (scoreDiff !== 0) return scoreDiff;
      const confidenceDiff = right.confidence - left.confidence;
      if (confidenceDiff !== 0) return confidenceDiff;
      const focusDiff = Number(right.focused) - Number(left.focused);
      if (focusDiff !== 0) return focusDiff;
      return left.symbol.localeCompare(right.symbol);
    });
}

function chooseAction(score: number, position?: PortfolioPositionValue): TradePlanSuggestedAction {
  if (score >= 0.25) return "buy_candidate";
  if (score <= -0.25) return position ? "sell_candidate" : "avoid";
  return "watch";
}

function selectBestOpportunity(opportunities: OpportunityRow[]): OpportunityRow | undefined {
  return [...opportunities].sort((left, right) => {
    const scoreDiff = Math.abs(right.score) - Math.abs(left.score);
    if (scoreDiff !== 0) return scoreDiff;
    return right.confidence - left.confidence;
  })[0];
}

function calculateConfidence(opportunities: OpportunityRow[], researchItems: ResearchItemRow[], focused: boolean): number {
  if (opportunities.length > 0) {
    const strongest = Math.max(...opportunities.map((opportunity) => opportunity.confidence));
    const sourceBonus = Math.min(0.08, opportunities.length * 0.02);
    return Number(clamp(strongest + sourceBonus, 0.05, 0.95).toFixed(4));
  }
  if (researchItems.length > 0) {
    return Number(clamp(Math.max(...researchItems.map((item) => item.confidence)) * 0.6, 0.05, 0.5).toFixed(4));
  }
  return focused ? 0.15 : 0.05;
}

function buildThesis(params: {
  symbol: string;
  bestOpportunity?: OpportunityRow;
  researchItems: ResearchItemRow[];
  focused: boolean;
  suggestedAction: TradePlanSuggestedAction;
}): string {
  if (params.bestOpportunity) {
    if (params.suggestedAction === "buy_candidate") {
      return `${params.bestOpportunity.thesis} Treat this as a research-positive paper candidate only while source strength remains current.`;
    }
    if (params.suggestedAction === "sell_candidate") {
      return `${params.bestOpportunity.thesis} Because the paper account already holds this symbol, current research argues for exit consideration.`;
    }
    if (params.suggestedAction === "avoid") {
      return `${params.bestOpportunity.thesis} The current source-backed signal is negative, so avoid a new long paper entry.`;
    }
    return `${params.bestOpportunity.thesis} The current research is not strong enough for a positive paper-trade candidate.`;
  }

  const latestHeadline = params.researchItems[0]?.headline;
  if (latestHeadline) {
    return `${params.symbol} has recent research coverage but no active high-confidence opportunity. Latest headline: ${latestHeadline}`;
  }
  if (params.focused) {
    return `${params.symbol} is focused for additional research. Wait for a fresh source-backed catalyst before treating it as tradable.`;
  }
  return `${params.symbol} has no active research catalyst.`;
}

function buildCatalyst(params: {
  bestOpportunity?: OpportunityRow;
  researchItems: ResearchItemRow[];
  focused: boolean;
}): string {
  if (params.bestOpportunity) return params.bestOpportunity.catalyst;
  const latest = params.researchItems[0];
  if (latest) return latest.catalyst ?? latest.headline;
  return params.focused ? "Focused for the next research crawl." : "No current catalyst.";
}

function buildAdviceReason(params: {
  suggestedAction: TradePlanSuggestedAction;
  opportunityCount: number;
  focused: boolean;
  position?: PortfolioPositionValue;
}): string {
  if (params.suggestedAction === "buy_candidate") {
    return "Positive source-backed research; paper auto-trade can still be blocked by size, caps, cooldown, or safety gates.";
  }
  if (params.suggestedAction === "sell_candidate") {
    return "Negative source-backed research and an existing paper position.";
  }
  if (params.suggestedAction === "avoid") {
    return "Current research is negative or risk-heavy.";
  }
  if (params.focused && params.opportunityCount === 0) {
    return "Focused for more research before advice changes.";
  }
  if (params.position) {
    return "Held position without a decisive current research edge.";
  }
  return "No decisive active opportunity.";
}

function buildRiskNotes(params: {
  symbol: string;
  opportunities: OpportunityRow[];
  focused: boolean;
  position?: PortfolioPositionValue;
}): string[] {
  const notes = uniqueValues(params.opportunities.flatMap((opportunity) => parseStringArray(opportunity.riskFlagsJson)));
  if (params.focused) notes.push("Focused research symbol.");
  if (params.position) notes.push(`Open paper holding: ${formatUsd(params.position.marketValue)}.`);
  if (params.opportunities.length === 0) notes.push("No active source-backed opportunity.");
  if (notes.length === 0) notes.push("No specific risk flag found beyond normal market risk.");
  return notes;
}

function mergeResearchItems(primary: ResearchItemRow[], extras: ResearchItemRow[]): ResearchItemRow[] {
  const rows = new Map<string, ResearchItemRow>();
  for (const row of [...primary, ...extras]) rows.set(row.id, row);
  return [...rows.values()].sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());
}

function latestDate(values: Date[]): Date | undefined {
  return values.sort((left, right) => right.getTime() - left.getTime())[0];
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function uniqueSymbols(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))];
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreClass(score: number): string {
  if (score >= 0.25) return "positive";
  if (score <= -0.25) return "negative";
  return "muted";
}

function formatAction(action: TradePlanSuggestedAction): string {
  if (action === "buy_candidate") return "Buy candidate";
  if (action === "sell_candidate") return "Sell candidate";
  if (action === "avoid") return "Avoid";
  return "Watch";
}

function formatUsd(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
