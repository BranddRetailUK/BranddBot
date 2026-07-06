import { DashboardNav } from "@/app/dashboard/DashboardNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="shell">
      <div className="dashboard">
        <header className="topbar">
          <div className="titleGroup">
            <h1>BranddBot</h1>
            <p>Paper trading dashboard for the RSI strategy, AI checks, research, and learning history.</p>
          </div>
        </header>
        <DashboardNav />
        {children}
      </div>
    </main>
  );
}
