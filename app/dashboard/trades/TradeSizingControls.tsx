"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import type { TradeSizingSettings } from "@/lib/types/trading";

export function TradeSizingControls({ initialSettings }: { initialSettings: TradeSizingSettings }) {
  const [minBid, setMinBid] = useState(String(initialSettings.minBidNotional));
  const [maxBid, setMaxBid] = useState(String(initialSettings.maxBidNotional));
  const [maxHolding, setMaxHolding] = useState(String(initialSettings.maxPositionNotionalPerSymbol));
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  async function saveSettings() {
    setSaving(true);
    setMessage(undefined);

    try {
      const response = await fetch("/api/settings/trade-sizing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minBidNotional: Number(minBid),
          maxBidNotional: Number(maxBid),
          maxPositionNotionalPerSymbol: Number(maxHolding)
        })
      });
      const payload = (await response.json()) as { settings?: TradeSizingSettings; error?: string };

      if (!response.ok || !payload.settings) {
        setMessage(payload.error ?? "Bid range update failed.");
        return;
      }

      setSettings(payload.settings);
      setMinBid(String(payload.settings.minBidNotional));
      setMaxBid(String(payload.settings.maxBidNotional));
      setMaxHolding(String(payload.settings.maxPositionNotionalPerSymbol));
      setMessage("Trade limits saved. The worker reads these before the next paper-trading loop.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Trade limit update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel tradeSizingPanel">
      <div className="panelHeader">
        <div>
          <span>Paper Bid Range</span>
          <h2>Research Auto-Trade Size</h2>
        </div>
      </div>
      <div className="panelBody tradeSizingBody">
        <div className="tradeSizingFields">
          <label className="fieldGroup">
            <span>Min bid</span>
            <div className="moneyInput">
              <span>$</span>
              <input
                inputMode="decimal"
                min="1"
                onChange={(event) => setMinBid(event.target.value)}
                step="1"
                type="number"
                value={minBid}
              />
            </div>
          </label>
          <label className="fieldGroup">
            <span>Max bid</span>
            <div className="moneyInput">
              <span>$</span>
              <input
                inputMode="decimal"
                min="1"
                onChange={(event) => setMaxBid(event.target.value)}
                step="1"
                type="number"
                value={maxBid}
              />
            </div>
          </label>
          <label className="fieldGroup">
            <span>Max holding</span>
            <div className="moneyInput">
              <span>$</span>
              <input
                inputMode="decimal"
                min="1"
                onChange={(event) => setMaxHolding(event.target.value)}
                step="1"
                type="number"
                value={maxHolding}
              />
            </div>
          </label>
          <button className="iconButton primary" disabled={saving} onClick={saveSettings} type="button">
            <Save size={16} />
            {saving ? "Saving" : "Save Limits"}
          </button>
        </div>
        <p className="sectionIntro">
          Current saved range: {formatUsd(settings.minBidNotional)} to {formatUsd(settings.maxBidNotional)} per order.
          The bot will not intentionally hold more than {formatUsd(settings.maxPositionNotionalPerSymbol)} of any one
          stock.
        </p>
        {message ? <div className="statusMessage">{message}</div> : null}
      </div>
    </section>
  );
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
