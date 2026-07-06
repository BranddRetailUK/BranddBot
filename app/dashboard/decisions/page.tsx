import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const audits = await prisma.aiAudit.findMany({ orderBy: { createdAt: "desc" }, take: 50 }).catch(() => []);

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <span>AI Decisions</span>
          <h2>Recent AI And Safety Checks</h2>
        </div>
      </div>
      <div className="panelBody">
        <p className="sectionIntro">
          Every scan creates a decision record. The AI can agree, hold, or block, but it cannot force a trade unless the RSI
          signal and safety checks also agree.
        </p>
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
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {audits.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No decision records yet.
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
                  <td>
                    <div>{audit.rationale}</div>
                    {!audit.accepted ? <div className="muted">{formatReasons(audit.rejectionReasonsJson)}</div> : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
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
