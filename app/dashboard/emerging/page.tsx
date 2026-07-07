import { Rocket, Search, ShieldCheck, Sparkles } from "lucide-react";
import { EmergingControls } from "@/app/dashboard/emerging/EmergingControls";
import { SymbolIdentity } from "@/app/dashboard/SymbolIdentity";
import { getEmergingSettings } from "@/lib/emerging/settings";
import { getStockAssets } from "@/lib/market/assets";
import { getPortfolioPositions } from "@/lib/portfolio/positions";
import { prisma } from "@/lib/db/prisma";

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
  confidence: number;
  publishedAt: Date;
};

type EmergingCandidateRow = {
  symbol: string;
  companyName?: string;
  tradable: boolean;
  fractionable: boolean;
  activeOpportunity?: OpportunityRow;
  latestResearch?: ResearchItemRow;
  positionValue?: number;
};

export default async function EmergingPage() {
  const settings = await getEmergingSettings();
  const symbols = settings.seedSymbols;
  const [opportunities, researchItems, portfolioPositions, assets] = await Promise.all([
    symbols.length > 0
      ? prisma.opportunity
          .findMany({
            where: { symbol: { in: symbols }, status: "active", expiresAt: { gt: new Date() } },
            orderBy: [{ score: "desc" }, { lastSeenAt: "desc" }],
            take: 120
          })
          .catch(() => [] as OpportunityRow[])
      : Promise.resolve([] as OpportunityRow[]),
    symbols.length > 0
      ? prisma.researchItem
          .findMany({ where: { symbol: { in: symbols } }, orderBy: { publishedAt: "desc" }, take: 120 })
          .catch(() => [] as ResearchItemRow[])
      : Promise.resolve([] as ResearchItemRow[]),
    getPortfolioPositions().catch(() => undefined),
    getStockAssets().catch(() => [])
  ]);
  const candidates = buildCandidateRows({
    symbols,
    opportunities,
    researchItems,
    positionValues: Object.fromEntries((portfolioPositions?.positions ?? []).map((position) => [position.symbol, position.marketValue])),
    assetsBySymbol: new Map(assets.map((asset) => [asset.symbol, asset]))
  });
  const activeCount = candidates.filter((candidate) => candidate.activeOpportunity).length;
  const tradableCount = candidates.filter((candidate) => candidate.tradable && candidate.fractionable).length;
  const holdingCount = candidates.filter((candidate) => candidate.positionValue).length;

  return (
    <div className="stack">
      <section className="grid cards">
        <Metric icon={<Rocket size={20} />} label="Seed Symbols" value={String(symbols.length)} />
        <Metric icon={<Sparkles size={20} />} label="Active Signals" value={String(activeCount)} />
        <Metric icon={<ShieldCheck size={20} />} label="Tradable" value={String(tradableCount)} />
        <Metric icon={<Search size={20} />} label="Held" value={String(holdingCount)} />
      </section>

      <section className="grid two emergingLayout">
        <EmergingControls initialSettings={settings} />
        <section className="panel">
          <div className="panelHeader">
            <div>
              <span>Coverage</span>
              <h2>Discovery Source</h2>
            </div>
          </div>
          <div className="panelBody stack">
            <Term title="Current feed">Alpaca News keyword discovery for IPO and emerging-tech language.</Term>
            <Term title="Saved filters">
              Price {formatUsd(settings.minPrice)}-{formatUsd(settings.maxPrice)}, market cap below{" "}
              {formatUsd(settings.maxMarketCapUsd)}, IPO age below {settings.maxIpoAgeDays} day(s), average volume above{" "}
              {settings.minAvgDailyVolume.toLocaleString()}.
            </Term>
            <Term title="Paper limits">
              Emerging lane max bid {formatUsd(settings.maxBidNotional)} and max holding{" "}
              {formatUsd(settings.maxPositionNotionalPerSymbol)} per symbol. Auto-trading remains separate from discovery.
            </Term>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <span>Emerging / IPO</span>
            <h2>Candidate Surface</h2>
          </div>
        </div>
        <div className="panelBody">
          <p className="sectionIntro">
            This lane tracks smaller or newly public candidates separately from the core watchlist. Symbols still need Alpaca
            tradability and the normal paper-risk controls before any future execution path can submit orders.
          </p>
        </div>
        <div className="tableWrap">
          <table className="wideTable">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Tradable</th>
                <th>Opportunity</th>
                <th>Latest Research</th>
                <th>Paper Holding</th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No emerging candidates yet. Add seed symbols or run discovery.
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => (
                  <tr key={candidate.symbol}>
                    <td>
                      <SymbolIdentity symbol={candidate.symbol} companyName={candidate.companyName} />
                    </td>
                    <td>
                      <strong className={candidate.tradable && candidate.fractionable ? "positive" : "muted"}>
                        {candidate.tradable && candidate.fractionable ? "Yes" : "No"}
                      </strong>
                      <div className="muted">{candidate.fractionable ? "Fractionable" : "Whole-share only or unavailable"}</div>
                    </td>
                    <td>
                      {candidate.activeOpportunity ? (
                        <>
                          <div className={`direction ${candidate.activeOpportunity.direction}`}>
                            {candidate.activeOpportunity.direction} {candidate.activeOpportunity.score.toFixed(3)}
                          </div>
                          <div>{candidate.activeOpportunity.catalyst}</div>
                          <div className="muted">{candidate.activeOpportunity.thesis}</div>
                        </>
                      ) : (
                        <span className="muted">No active opportunity</span>
                      )}
                    </td>
                    <td>
                      {candidate.latestResearch ? (
                        <>
                          <a href={candidate.latestResearch.sourceUrl} rel="noreferrer" target="_blank">
                            {candidate.latestResearch.headline}
                          </a>
                          <div className="muted">{candidate.latestResearch.publishedAt.toLocaleString()}</div>
                        </>
                      ) : (
                        <span className="muted">No source-backed item yet</span>
                      )}
                    </td>
                    <td>{candidate.positionValue ? formatUsd(candidate.positionValue) : <span className="muted">None</span>}</td>
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

function buildCandidateRows(params: {
  symbols: string[];
  opportunities: OpportunityRow[];
  researchItems: ResearchItemRow[];
  positionValues: Record<string, number>;
  assetsBySymbol: Map<string, { name: string; tradable: boolean; fractionable: boolean }>;
}): EmergingCandidateRow[] {
  return params.symbols.map((symbol) => {
    const asset = params.assetsBySymbol.get(symbol);
    return {
      symbol,
      companyName: asset?.name,
      tradable: asset?.tradable ?? false,
      fractionable: asset?.fractionable ?? false,
      activeOpportunity: params.opportunities.find((opportunity) => opportunity.symbol === symbol),
      latestResearch: params.researchItems.find((item) => item.symbol === symbol),
      positionValue: params.positionValues[symbol]
    };
  });
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

function Term({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="term">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
