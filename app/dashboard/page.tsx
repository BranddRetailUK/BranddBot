import { Activity, Brain, Shield, Zap } from "lucide-react";
import { BotControls } from "@/app/dashboard/BotControls";
import { getPublicRuntimeSummary } from "@/lib/config/env";
import { getBotEnabled } from "@/lib/db/botConfig";
import { getFocusedSymbols } from "@/lib/db/focusSymbols";
import { prisma } from "@/lib/db/prisma";
import { getTradeSizingSettings } from "@/lib/trading/tradeSizing";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [enabled, latest, activeOpportunityCount, openTradeCount, tradeSizing, focusedSymbols] = await Promise.all([
    getBotEnabled().catch(() => false),
    prisma.aiAudit.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null),
    prisma.opportunity.count({ where: { status: "active", expiresAt: { gt: new Date() } } }).catch(() => 0),
    prisma.trade.count({ where: { closedAt: null, status: { in: ["accepted", "new", "partially_filled", "filled"] } } }).catch(() => 0),
    getTradeSizingSettings(),
    getFocusedSymbols().catch(() => [])
  ]);
  const runtime = getPublicRuntimeSummary();

  return (
    <>
      <div className="badgeRow pageBadges">
        <span className={runtime.tradingMode === "paper" && runtime.paperTradingEndpoint ? "badge success" : "badge danger"}>
          {runtime.tradingMode.toUpperCase()} trading
        </span>
        <span className={runtime.openAiConfigured ? "badge success" : "badge danger"}>
          OpenAI {runtime.openAiConfigured ? "configured" : "missing"}
        </span>
        <span className={runtime.alpacaConfigured ? "badge success" : "badge danger"}>
          Alpaca {runtime.alpacaConfigured ? "configured" : "missing"}
        </span>
        <span className={enabled ? "badge success" : "badge"}>{enabled ? "Enabled" : "Paused"}</span>
        <span className={runtime.researchAutoTrade.enabled ? "badge success" : "badge"}>
          Research auto {runtime.researchAutoTrade.enabled ? "on" : "off"}
        </span>
      </div>

      <section className="grid cards">
        <Metric icon={<Brain size={20} />} label="AI Model" value={runtime.openAiModel} />
        <Metric icon={<Activity size={20} />} label="Watchlist" value={runtime.watchlist.join(", ")} />
        <Metric icon={<Shield size={20} />} label="Bid Range" value={`$${tradeSizing.minBidNotional}-$${tradeSizing.maxBidNotional}`} />
        <Metric
          icon={<Zap size={20} />}
          label="Research Auto"
          value={
            runtime.researchAutoTrade.enabled
              ? `$${tradeSizing.maxBidNotional}/max`
              : "Off"
          }
        />
      </section>

      <section className="grid two">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <span>Controls</span>
              <h2>Paper Bot Actions</h2>
            </div>
          </div>
          <div className="panelBody stack">
            <p className="sectionIntro">
              Paper trading uses simulated money. These controls run the bot against your Alpaca paper account, so this is for
              testing behavior before any real-money design is considered.
            </p>
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
                  {latest.accepted ? "Accepted by safety checks" : `Blocked or held: ${formatReasons(latest.rejectionReasonsJson)}`}
                </div>
              </div>
            ) : (
              <div className="muted">No scans recorded yet.</div>
            )}
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panelHeader">
          <div>
            <span>Current Shape</span>
            <h2>Bot State</h2>
          </div>
        </div>
        <div className="panelBody stack">
          <Term title="Open paper trades">
            {openTradeCount} trade record(s) are currently open or waiting for reconciliation.
          </Term>
          <Term title="Research symbols">
            Base list {formatSymbolList(runtime.research.symbols)}
            {focusedSymbols.length > 0 ? ` plus focused ${formatSymbolList(focusedSymbols)}` : ""}; capped at{" "}
            {runtime.research.maxSymbols} symbol(s) per crawl.
          </Term>
          <Term title="Research auto-trading">
            {runtime.researchAutoTrade.enabled
              ? `Enabled for up to ${runtime.researchAutoTrade.maxItemsPerRun} paper order(s) per worker run, ${runtime.researchAutoTrade.maxDailyOrders} per day, with a ${runtime.researchAutoTrade.symbolCooldownMinutes} minute symbol cooldown.`
              : "Disabled. Positive research opportunities will not directly place paper orders."}
          </Term>
          <Term title="Active opportunities">
            {activeOpportunityCount} active source-backed opportunity record(s) are available for plans, AI context, and research auto-trading.
          </Term>
          <Term title="Maximum position per symbol">
            The bot will not intentionally hold more than ${tradeSizing.maxPositionNotionalPerSymbol} of one symbol in
            the current paper-risk settings.
          </Term>
        </div>
      </section>
    </>
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

function Term({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="term">
      <strong>{title}</strong>
      <p>{children}</p>
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

function formatSymbolList(symbols: string[]): string {
  return symbols.length > 0 ? symbols.join(", ") : "none";
}
