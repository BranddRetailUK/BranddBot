"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LineChart, ListChecks, Newspaper, TrendingUp } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Overview", icon: Activity },
  { href: "/dashboard/plan", label: "Trade Plan", icon: ListChecks },
  { href: "/dashboard/trades", label: "Trades", icon: LineChart },
  { href: "/dashboard/stocks", label: "Stocks", icon: TrendingUp },
  { href: "/dashboard/research", label: "Research", icon: Newspaper }
] as const;

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="topNav" aria-label="Dashboard navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} className={active ? "navLink active" : "navLink"}>
            <Icon size={16} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
