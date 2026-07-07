"use client";

import { useEffect, useMemo, useState } from "react";
import type { PortfolioHistoryResult, PortfolioSnapshotPoint } from "@/lib/types/trading";

const POLL_MS = 15_000;
const RANGE_OPTIONS = [1, 6, 24, 72] as const;

export function PortfolioValueChart({ initialHistory }: { initialHistory?: PortfolioHistoryResult }) {
  const [history, setHistory] = useState<PortfolioHistoryResult | undefined>(initialHistory);
  const [rangeHours, setRangeHours] = useState(initialHistory?.rangeHours ?? 24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(initialHistory?.error);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/portfolio/history?rangeHours=${rangeHours}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as PortfolioHistoryResult | { error?: string };
        if (!active) return;

        if (!response.ok) {
          setError(payload.error ?? "Portfolio history request failed.");
          return;
        }

        setHistory(payload as PortfolioHistoryResult);
        setError((payload as PortfolioHistoryResult).error);
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Portfolio history request failed.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const timer = window.setInterval(load, POLL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [rangeHours]);

  const chart = useMemo(() => buildChart(history?.points ?? []), [history?.points]);
  const latest = history?.latest;
  const change = history?.change ?? 0;
  const changePercent = history?.changePercent ?? 0;
  const isPositive = change >= 0;

  return (
    <section className="panel portfolioPanel">
      <div className="panelHeader portfolioHeader">
        <div>
          <span>Portfolio Value</span>
          <h2>Live Paper P/L</h2>
        </div>
        <div className="rangeControls" aria-label="Portfolio chart range">
          {RANGE_OPTIONS.map((hours) => (
            <button
              className={rangeHours === hours ? "rangeButton active" : "rangeButton"}
              key={hours}
              onClick={() => setRangeHours(hours)}
              type="button"
            >
              {hours === 72 ? "3D" : `${hours}H`}
            </button>
          ))}
        </div>
      </div>

      <div className="panelBody portfolioBody">
        <div className="portfolioStats">
          <Stat label="Current Value" value={latest ? formatUsd(latest.portfolioValue) : "-"} />
          <Stat
            className={isPositive ? "positive" : "negative"}
            label="P/L In Range"
            value={`${isPositive ? "+" : "-"}${formatUsd(Math.abs(change))}`}
            detail={history?.baselineValue ? `${formatPercent(changePercent)} from first point` : "Waiting for baseline"}
          />
          <Stat
            className={latest && latest.unrealizedPnl < 0 ? "negative" : "positive"}
            label="Unrealized P/L"
            value={latest ? formatSignedUsd(latest.unrealizedPnl) : "-"}
          />
          <Stat label="Cash" value={latest ? formatUsd(latest.cash) : "-"} detail={`${latest?.openPositionsCount ?? 0} open`} />
        </div>

        <div className="chartFrame">
          {chart.points.length > 0 ? (
            <svg className="portfolioChart" viewBox="0 0 900 260" role="img" aria-label="Portfolio value over time">
              <line className="chartGridLine" x1="58" x2="846" y1={chart.zeroY} y2={chart.zeroY} />
              <path className="chartArea" d={chart.areaPath} />
              <polyline className="chartLine" points={chart.polyline} />
              {chart.points.map((point) => (
                <circle className="chartPoint" cx={point.x} cy={point.y} key={point.key} r={point.isLatest ? 2.6 : 1.25} />
              ))}
              <text className="axisLabel" x="58" y="20">
                {formatUsd(chart.maxValue)}
              </text>
              <text className="axisLabel" x="58" y="242">
                {formatUsd(chart.minValue)}
              </text>
              <text className="axisLabel" x="846" y="242" textAnchor="end">
                {latest ? formatTime(latest.createdAt) : ""}
              </text>
            </svg>
          ) : (
            <div className="emptyChart">
              <strong>No portfolio snapshots yet.</strong>
              <span>The chart will populate after the worker or this page records the first Alpaca paper account snapshot.</span>
            </div>
          )}
        </div>

        <div className="portfolioFooter">
          <span>{loading ? "Refreshing..." : "Live refresh every 15 seconds"}</span>
          <span>{latest ? `Last point ${formatDateTime(latest.createdAt)}` : "No latest point"}</span>
          {error ? <span className="negative">{error}</span> : null}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
  className
}: {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className="portfolioStat">
      <span>{label}</span>
      <strong className={className}>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function buildChart(points: PortfolioSnapshotPoint[]) {
  const width = 900;
  const height = 260;
  const left = 58;
  const right = 846;
  const top = 22;
  const bottom = 224;
  const values = points.map((point) => point.portfolioValue);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = Math.max(1, rawMax - rawMin);
  const minValue = rawMin - range * 0.12;
  const maxValue = rawMax + range * 0.12;
  const valueRange = Math.max(1, maxValue - minValue);
  const firstTime = new Date(points[0]?.createdAt ?? Date.now()).getTime();
  const lastTime = new Date(points.at(-1)?.createdAt ?? Date.now()).getTime();
  const timeRange = Math.max(1, lastTime - firstTime);

  const mapped = points.map((point, index) => {
    const time = new Date(point.createdAt).getTime();
    const x = points.length === 1 ? (left + right) / 2 : left + ((time - firstTime) / timeRange) * (right - left);
    const y = bottom - ((point.portfolioValue - minValue) / valueRange) * (bottom - top);
    return {
      key: point.id ?? `${point.createdAt}-${index}`,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      isLatest: index === points.length - 1
    };
  });

  const polyline = mapped.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath =
    mapped.length > 0
      ? `M ${mapped[0].x} ${bottom} L ${mapped.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${
          mapped[mapped.length - 1].x
        } ${bottom} Z`
      : "";
  const zeroY = bottom - ((points[0]?.portfolioValue ?? minValue) - minValue) / valueRange * (bottom - top);

  return {
    width,
    height,
    minValue,
    maxValue,
    points: mapped,
    polyline,
    areaPath,
    zeroY: Number(zeroY.toFixed(2))
  };
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSignedUsd(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatUsd(Math.abs(value))}`;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${Math.abs(value * 100).toFixed(2)}%`;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    month: "short",
    day: "numeric"
  });
}
