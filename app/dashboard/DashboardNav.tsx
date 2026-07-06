"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpenText, ClipboardList, LineChart, Newspaper } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Overview", icon: Activity },
  { href: "/dashboard/decisions", label: "AI Decisions", icon: ClipboardList },
  { href: "/dashboard/trades", label: "Trades", icon: LineChart },
  { href: "/dashboard/research", label: "Research", icon: Newspaper },
  { href: "/dashboard/guide", label: "Beginner Guide", icon: BookOpenText }
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
