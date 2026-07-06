import { prisma } from "@/lib/db/prisma";
import { getPortfolioHistory } from "@/lib/portfolio/snapshots";
import { PortfolioValueChart } from "@/app/dashboard/trades/PortfolioValueChart";

export const dynamic = "force-dynamic";

export default async function TradesPage() {
  const [trades, learningEvents, portfolioHistory] = await Promise.all([
    prisma.trade.findMany({ orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []),
    prisma.learningEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12 }).catch(() => []),
    getPortfolioHistory({ refresh: false, rangeHours: 24 }).catch(() => undefined)
  ]);

  const closedTrades = trades.filter((trade) => trade.closedAt);
  const realizedPnl = closedTrades.reduce((sum, trade) => sum + (trade.realizedPnl ?? 0), 0);

  return (
    <div className="stack">
      <section className="grid cards">
        <Metric label="Trade Records" value={String(trades.length)} />
        <Metric label="Closed Trades" value={String(closedTrades.length)} />
        <Metric label="Realized P/L" value={formatUsd(realizedPnl)} />
        <Metric label="Learning Notes" value={String(learningEvents.length)} />
      </section>

      <PortfolioValueChart initialHistory={portfolioHistory} />

      <section className="panel">
        <div className="panelHeader">
          <div>
            <span>Trades</span>
            <h2>Paper Trade History</h2>
          </div>
        </div>
        <div className="panelBody">
          <p className="sectionIntro">
            A trade record is created when the bot submits a paper order. Reconciliation checks Alpaca later for fill price,
            filled quantity, and whether a sell closed a previous buy.
          </p>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Strategy</th>
                <th>Status</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Realized P/L</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    No paper trade records yet.
                  </td>
                </tr>
              ) : (
                trades.map((trade) => (
                  <tr key={trade.id}>
                    <td>{trade.createdAt.toLocaleString()}</td>
                    <td>{trade.symbol}</td>
                    <td>{trade.side.toUpperCase()}</td>
                    <td>{trade.strategy}</td>
                    <td>{trade.status}</td>
                    <td>{trade.qty?.toFixed(4) ?? "-"}</td>
                    <td>{trade.price ? formatUsd(trade.price) : "-"}</td>
                    <td className={trade.realizedPnl && trade.realizedPnl < 0 ? "negative" : "positive"}>
                      {trade.realizedPnl === null ? "-" : formatUsd(trade.realizedPnl ?? 0)}
                    </td>
                    <td>{trade.rationale ?? ""}</td>
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
            <span>Learning</span>
            <h2>Recent Learning Notes</h2>
          </div>
        </div>
        <div className="panelBody stack">
          <p className="sectionIntro">
            Learning notes are short memory entries. Some come from the AI during scans, and outcome notes come from closed
            paper trades after reconciliation.
          </p>
          {learningEvents.length === 0 ? (
            <div className="muted">No learning notes yet.</div>
          ) : (
            learningEvents.map((event) => (
              <div className="logItem" key={event.id}>
                <strong>
                  {event.symbol} reward {event.reward.toFixed(3)}
                </strong>
                <p>
                  {event.summary} · {event.source} · {event.createdAt.toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatUsd(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}
