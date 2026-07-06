import { Activity, Brain, DollarSign, Shield } from "lucide-react";
import { BotControls } from "@/app/dashboard/BotControls";
import { getPublicRuntimeSummary } from "@/lib/config/env";
import { getBotEnabled } from "@/lib/db/botConfig";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [enabled, audits, trades] = await Promise.all([
    getBotEnabled().catch(() => false),
    prisma.aiAudit.findMany({ orderBy: { createdAt: "desc" }, take: 12 }).catch(() => []),
    prisma.trade.findMany({ orderBy: { createdAt: "desc" }, take: 8 }).catch(() => [])
  ]);
  const runtime = getPublicRuntimeSummary();
  const latest = audits[0];
  const acceptedCount = audits.filter((audit) => audit.accepted).length;

  return (
    <main className="shell">
      <div className="dashboard">
        <header className="topbar">
          <div className="titleGroup">
            <h1>BranddBot</h1>
            <p>RSI paper-trading control surface with OpenAI-gated reasoning.</p>
          </div>
          <div className="badgeRow">
            <span className={runtime.tradingMode === "paper" ? "badge success" : "badge danger"}>
              {runtime.tradingMode.toUpperCase()}
            </span>
            <span className={runtime.openAiConfigured ? "badge success" : "badge danger"}>
              OpenAI {runtime.openAiConfigured ? "configured" : "missing"}
            </span>
            <span className={runtime.alpacaConfigured ? "badge success" : "badge danger"}>
              Alpaca {runtime.alpacaConfigured ? "configured" : "missing"}
            </span>
            <span className={enabled ? "badge success" : "badge"}>{enabled ? "Enabled" : "Paused"}</span>
          </div>
        </header>

        <section className="grid cards">
          <Metric icon={<Brain size={20} />} label="Model" value={runtime.openAiModel} />
          <Metric icon={<Activity size={20} />} label="Watchlist" value={runtime.watchlist.join(", ")} />
          <Metric icon={<Shield size={20} />} label="Max Order" value={`$${runtime.risk.maxNotionalPerOrder}`} />
          <Metric icon={<DollarSign size={20} />} label="Accepted Audits" value={String(acceptedCount)} />
        </section>

        <section className="grid two">
          <div className="panel">
            <div className="panelHeader">
              <div>
                <span>Controls</span>
                <h2>Paper Bot Actions</h2>
              </div>
            </div>
            <div className="panelBody">
              <BotControls enabled={enabled} />
            </div>
          </div>

          <div className="panel">
            <div className="panelHeader">
              <div>
                <span>Latest AI Decision</span>
                <h2>{latest ? latest.symbol : "No scan yet"}</h2>
              </div>
            </div>
            <div className="panelBody">
              {latest ? (
                <div className="stack">
                  <div>
                    <span className={`decision ${latest.decision}`}>{latest.decision}</span>
                    <span className="muted"> confidence {latest.confidence.toFixed(2)}</span>
                  </div>
                  <div>{latest.rationale}</div>
                  <div className="muted">
                    {latest.accepted ? "Accepted by risk gates" : `Blocked/Held: ${formatReasons(latest.rejectionReasonsJson)}`}
                  </div>
                </div>
              ) : (
                <div className="muted">Run a dry scan after adding credentials.</div>
              )}
            </div>
          </div>
        </section>

        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panelHeader">
            <div>
              <span>Audit Trail</span>
              <h2>Recent AI and Risk Decisions</h2>
            </div>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Symbol</th>
                  <th>Decision</th>
                  <th>Confidence</th>
                  <th>Accepted</th>
                  <th>Rationale</th>
                </tr>
              </thead>
              <tbody>
                {audits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No AI audit records yet.
                    </td>
                  </tr>
                ) : (
                  audits.map((audit) => (
                    <tr key={audit.id}>
                      <td>{audit.createdAt.toLocaleString()}</td>
                      <td>{audit.symbol}</td>
                      <td className={`decision ${audit.decision}`}>{audit.decision}</td>
                      <td>{audit.confidence.toFixed(2)}</td>
                      <td>{audit.accepted ? "Yes" : "No"}</td>
                      <td>{audit.rationale}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panelHeader">
            <div>
              <span>Orders</span>
              <h2>Recent Paper Trades</h2>
            </div>
          </div>
          <div className="panelBody stack">
            {trades.length === 0 ? (
              <div className="muted">No paper trade records yet.</div>
            ) : (
              trades.map((trade) => (
                <div className="logItem" key={trade.id}>
                  <strong>
                    {trade.symbol} {trade.side.toUpperCase()} {trade.notional ? `$${trade.notional}` : trade.qty ?? ""}
                  </strong>
                  <p>
                    {trade.status} · {trade.createdAt.toLocaleString()} · {trade.rationale}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
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

function formatReasons(json: string): string {
  try {
    const reasons = JSON.parse(json) as string[];
    return reasons.join(" ");
  } catch {
    return json;
  }
}
