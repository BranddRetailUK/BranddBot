import { ClipboardCheck, ListChecks, Radar, ShieldCheck } from "lucide-react";
import { PlanControls } from "@/app/dashboard/plan/PlanControls";
import { getLatestTradePlan } from "@/lib/plan/builder";
import type { TradePlanItemSummary, TradePlanSuggestedAction } from "@/lib/types/trading";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const plan = await getLatestTradePlan().catch(() => undefined);
  const itemCount = plan?.items.length ?? 0;
  const tradableCount = plan?.items.filter((item) => item.tradableNow).length ?? 0;
  const rsiEligibleCount = plan?.items.filter((item) => item.eligibleForRsi).length ?? 0;

  return (
    <div className="stack">
      <section className="grid cards">
        <Metric icon={<ListChecks size={20} />} label="Plan Items" value={String(itemCount)} />
        <Metric icon={<Radar size={20} />} label="RSI Eligible" value={String(rsiEligibleCount)} />
        <Metric icon={<ShieldCheck size={20} />} label="Tradable Candidates" value={String(tradableCount)} />
        <Metric icon={<ClipboardCheck size={20} />} label="Mode" value="Advisory" />
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <span>Trade Plan</span>
            <h2>{plan ? `Generated ${new Date(plan.generatedAt).toLocaleString()}` : "No plan generated yet"}</h2>
          </div>
          <PlanControls />
        </div>
        <div className="panelBody stack">
          <p className="sectionIntro">
            The trade plan ranks research-backed candidates before they are eligible for paper trading consideration. It is
            advisory only: plan items do not place orders and do not bypass RSI, OpenAI review, or the risk gate.
          </p>
          {plan ? (
            <div className="badgeRow pageBadges">
              <span className="badge">Opportunities read: {plan.inputSummary.opportunityCount}</span>
              <span className="badge">Current positions read: {plan.inputSummary.positionCount}</span>
              <span className="badge">Learning notes read: {plan.inputSummary.learningNoteCount}</span>
              <span className="badge success">Advisory only</span>
            </div>
          ) : null}
        </div>
        <div className="tableWrap">
          <table className="wideTable">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Symbol</th>
                <th>Suggested Action</th>
                <th>Confidence</th>
                <th>Thesis</th>
                <th>Catalyst / News Reason</th>
                <th>Risk Notes</th>
                <th>RSI Eligible</th>
                <th>Tradable Now</th>
              </tr>
            </thead>
            <tbody>
              {!plan || plan.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    No plan items yet. Generate a plan after research opportunities exist.
                  </td>
                </tr>
              ) : (
                plan.items.map((item) => <PlanRow key={item.id ?? `${item.rank}-${item.symbol}`} item={item} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PlanRow({ item }: { item: TradePlanItemSummary }) {
  return (
    <tr>
      <td>{item.rank}</td>
      <td>{item.symbol}</td>
      <td>
        <span className={`planAction ${item.suggestedAction}`}>{formatAction(item.suggestedAction)}</span>
      </td>
      <td>{item.confidence.toFixed(2)}</td>
      <td>{item.thesis}</td>
      <td>
        <div>{item.catalyst}</div>
        {item.sourceUrls.length > 0 ? (
          <div className="sourceLinks">
            {item.sourceUrls.slice(0, 3).map((url, index) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                Source {index + 1}
              </a>
            ))}
          </div>
        ) : null}
      </td>
      <td>{item.riskNotes.join(" ")}</td>
      <td>{item.eligibleForRsi ? "Yes" : "No"}</td>
      <td>
        <strong className={item.tradableNow ? "positive" : "muted"}>{item.tradableNow ? "Yes" : "No"}</strong>
        <div className="muted">{item.tradabilityReason}</div>
      </td>
    </tr>
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

function formatAction(action: TradePlanSuggestedAction): string {
  if (action === "buy_candidate") return "Buy candidate";
  if (action === "sell_candidate") return "Sell candidate";
  if (action === "avoid") return "Avoid";
  return "Watch";
}
