import { SymbolIdentity } from "@/app/dashboard/SymbolIdentity";
import { prisma } from "@/lib/db/prisma";
import { getStockAssetNameMap } from "@/lib/market/assets";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const [opportunities, researchItems] = await Promise.all([
    prisma.opportunity
      .findMany({
        where: { status: "active", expiresAt: { gt: new Date() } },
        orderBy: [{ score: "desc" }, { lastSeenAt: "desc" }],
        take: 40
      })
      .catch(() => []),
    prisma.researchItem.findMany({ orderBy: { publishedAt: "desc" }, take: 40 }).catch(() => [])
  ]);
  const companyNames: Record<string, string> = await getStockAssetNameMap([
    ...opportunities.map((opportunity) => opportunity.symbol),
    ...researchItems.map((item) => item.symbol)
  ]).catch(() => ({}));

  return (
    <div className="stack">
      <section className="panel">
        <div className="panelHeader">
          <div>
            <span>Research</span>
            <h2>Active Market Opportunities</h2>
          </div>
        </div>
        <div className="panelBody">
          <p className="sectionIntro">
            An opportunity is a source-backed idea from market news. It can help the AI understand context, but it does not
            place a trade by itself. RSI and the risk gate still decide whether a paper order is allowed.
          </p>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Direction</th>
                <th>Confidence</th>
                <th>Score</th>
                <th>Catalyst</th>
                <th>Thesis</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No active opportunities yet. Run the research crawler to import news.
                  </td>
                </tr>
              ) : (
                opportunities.map((opportunity) => (
                  <tr key={opportunity.id}>
                    <td>
                      <SymbolIdentity symbol={opportunity.symbol} companyName={companyNames[opportunity.symbol]} />
                    </td>
                    <td className={`direction ${opportunity.direction}`}>{labelDirection(opportunity.direction)}</td>
                    <td>{opportunity.confidence.toFixed(2)}</td>
                    <td>{opportunity.score.toFixed(3)}</td>
                    <td>{opportunity.catalyst}</td>
                    <td>{opportunity.thesis}</td>
                    <td>{opportunity.expiresAt.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <span>Sources</span>
            <h2>Recent Research Items</h2>
          </div>
        </div>
        <div className="panelBody">
          <p className="sectionIntro">
            Research items are the raw news records stored by the crawler. The bot keeps source links and timestamps because
            news can become stale quickly.
          </p>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Published</th>
                <th>Symbol</th>
                <th>Source</th>
                <th>Headline</th>
                <th>Signal</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {researchItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No research items yet.
                  </td>
                </tr>
              ) : (
                researchItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.publishedAt.toLocaleString()}</td>
                    <td>
                      <SymbolIdentity symbol={item.symbol} companyName={companyNames[item.symbol]} />
                    </td>
                    <td>{item.source}</td>
                    <td>
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                        {item.headline}
                      </a>
                    </td>
                    <td className={`direction ${item.sentiment}`}>{labelDirection(item.sentiment)}</td>
                    <td>{item.confidence.toFixed(2)}</td>
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

function labelDirection(direction: string): string {
  if (direction === "bullish") return "Positive";
  if (direction === "bearish") return "Risk";
  return "Watch";
}
