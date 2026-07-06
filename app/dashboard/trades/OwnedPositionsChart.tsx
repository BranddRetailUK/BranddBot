"use client";

import { useEffect, useState } from "react";
import type { PortfolioPositionsResult } from "@/lib/types/trading";

const POLL_MS = 15_000;

export function OwnedPositionsChart({ initialPositions }: { initialPositions?: PortfolioPositionsResult }) {
  const [positions, setPositions] = useState<PortfolioPositionsResult | undefined>(initialPositions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(initialPositions?.error);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/portfolio/positions", { cache: "no-store" });
        const payload = (await response.json()) as PortfolioPositionsResult;
        if (!active) return;

        if (!response.ok) {
          setError(payload.error ?? "Positions request failed.");
          return;
        }

        setPositions(payload);
        setError(payload.error);
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Positions request failed.");
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
  }, []);

  const rows = positions?.positions ?? [];

  return (
    <section className="panel positionsPanel">
      <div className="panelHeader portfolioHeader">
        <div>
          <span>Current Holdings</span>
          <h2>Owned Stock Value</h2>
        </div>
        <div className="muted">{positions ? `${rows.length} position(s), ${formatUsd(positions.totalMarketValue)}` : "Loading"}</div>
      </div>
      <div className="panelBody positionsBody">
        {rows.length === 0 ? (
          <div className="emptyChart">
            <strong>No open paper positions.</strong>
            <span>Owned stocks will appear here once Alpaca reports open long positions.</span>
          </div>
        ) : (
          <div className="positionBars">
            {rows.map((position) => {
              const width = `${Math.max(2, position.allocationPercent * 100).toFixed(2)}%`;
              return (
                <div className="positionBarRow" key={position.symbol}>
                  <div className="positionBarMeta">
                    <strong>{position.symbol}</strong>
                    <span>{formatQuantity(position.qty)} shares</span>
                  </div>
                  <div className="positionBarTrack" aria-label={`${position.symbol} ${formatUsd(position.marketValue)}`}>
                    <div className="positionBarFill" style={{ width }} />
                  </div>
                  <div className="positionBarValue">
                    <strong>{formatUsd(position.marketValue)}</strong>
                    <span className={position.unrealizedPnl < 0 ? "negative" : "positive"}>
                      {formatSignedUsd(position.unrealizedPnl)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="portfolioFooter">
          <span>{loading ? "Refreshing..." : "Live refresh every 15 seconds"}</span>
          <span>{positions ? `Last point ${formatDateTime(positions.generatedAt)}` : "No latest point"}</span>
          {error ? <span className="negative">{error}</span> : null}
        </div>
      </div>
    </section>
  );
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSignedUsd(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatUsd(Math.abs(value))}`;
}

function formatQuantity(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
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
