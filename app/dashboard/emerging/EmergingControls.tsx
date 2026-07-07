"use client";

import { Radar, Save, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  EmergingDiscoveryCandidate,
  EmergingResearchSettings,
  EmergingSettingsRecommendation
} from "@/lib/types/trading";

export function EmergingControls({ initialSettings }: { initialSettings: EmergingResearchSettings }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [seedSymbols, setSeedSymbols] = useState(initialSettings.seedSymbols.join(", "));
  const [maxSymbols, setMaxSymbols] = useState(String(initialSettings.maxSymbols));
  const [newsLookbackHours, setNewsLookbackHours] = useState(String(initialSettings.newsLookbackHours));
  const [newsLimit, setNewsLimit] = useState(String(initialSettings.newsLimit));
  const [minOpportunityConfidence, setMinOpportunityConfidence] = useState(String(initialSettings.minOpportunityConfidence));
  const [minPrice, setMinPrice] = useState(String(initialSettings.minPrice));
  const [maxPrice, setMaxPrice] = useState(String(initialSettings.maxPrice));
  const [minAvgDailyVolume, setMinAvgDailyVolume] = useState(String(initialSettings.minAvgDailyVolume));
  const [maxMarketCapUsd, setMaxMarketCapUsd] = useState(String(initialSettings.maxMarketCapUsd));
  const [maxIpoAgeDays, setMaxIpoAgeDays] = useState(String(initialSettings.maxIpoAgeDays));
  const [maxBidNotional, setMaxBidNotional] = useState(String(initialSettings.maxBidNotional));
  const [maxPositionNotionalPerSymbol, setMaxPositionNotionalPerSymbol] = useState(
    String(initialSettings.maxPositionNotionalPerSymbol)
  );
  const [message, setMessage] = useState("");
  const [recommendationReasons, setRecommendationReasons] = useState<string[]>([]);
  const [discoveryCandidates, setDiscoveryCandidates] = useState<EmergingDiscoveryCandidate[]>([]);
  const [isPending, startTransition] = useTransition();

  function saveSettings() {
    setMessage("");
    setRecommendationReasons([]);
    startTransition(async () => {
      try {
        const response = await fetch("/api/settings/emerging", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload())
        });
        const payload = (await response.json()) as { settings?: EmergingResearchSettings; error?: string };
        if (!response.ok || !payload.settings) {
          setMessage(payload.error ?? "Emerging settings update failed.");
          return;
        }
        applySettings(payload.settings);
        setMessage("Emerging/IPO settings saved.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Emerging settings update failed.");
      }
    });
  }

  function runDiscovery() {
    setMessage("");
    setRecommendationReasons([]);
    setDiscoveryCandidates([]);
    startTransition(async () => {
      try {
        const response = await fetch("/api/emerging/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saveSymbols: true })
        });
        const payload = (await response.json()) as {
          result?: { candidates: EmergingDiscoveryCandidate[]; addedSymbols: string[]; settings: EmergingResearchSettings };
          error?: string;
        };
        if (!response.ok || !payload.result) {
          setMessage(payload.error ?? "Emerging discovery failed.");
          return;
        }
        setDiscoveryCandidates(payload.result.candidates);
        setMessage(
          `Discovery scanned recent IPO/emerging-tech news and added ${payload.result.addedSymbols.length} symbol(s).`
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Emerging discovery failed.");
      }
    });
  }

  function recommendSettings() {
    setMessage("");
    setRecommendationReasons([]);
    setDiscoveryCandidates([]);
    startTransition(async () => {
      try {
        const response = await fetch("/api/settings/emerging/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ save: true })
        });
        const payload = (await response.json()) as {
          recommendation?: EmergingSettingsRecommendation;
          error?: string;
        };
        if (!response.ok || !payload.recommendation) {
          setMessage(payload.error ?? "Emerging recommendation failed.");
          return;
        }
        applySettings(payload.recommendation.settings);
        setRecommendationReasons(payload.recommendation.reasons);
        setMessage(
          `Recommended options saved from ${payload.recommendation.sourceCounts.matchedSignals} matching research signal(s).`
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Emerging recommendation failed.");
      }
    });
  }

  function buildPayload(): Partial<EmergingResearchSettings> {
    return {
      enabled,
      seedSymbols: seedSymbols
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean),
      maxSymbols: Number(maxSymbols),
      newsLookbackHours: Number(newsLookbackHours),
      newsLimit: Number(newsLimit),
      minOpportunityConfidence: Number(minOpportunityConfidence),
      minPrice: Number(minPrice),
      maxPrice: Number(maxPrice),
      minAvgDailyVolume: Number(minAvgDailyVolume),
      maxMarketCapUsd: Number(maxMarketCapUsd),
      maxIpoAgeDays: Number(maxIpoAgeDays),
      maxBidNotional: Number(maxBidNotional),
      maxPositionNotionalPerSymbol: Number(maxPositionNotionalPerSymbol)
    };
  }

  function applySettings(nextSettings: EmergingResearchSettings) {
    setSettings(nextSettings);
    setEnabled(nextSettings.enabled);
    setSeedSymbols(nextSettings.seedSymbols.join(", "));
    setMaxSymbols(String(nextSettings.maxSymbols));
    setNewsLookbackHours(String(nextSettings.newsLookbackHours));
    setNewsLimit(String(nextSettings.newsLimit));
    setMinOpportunityConfidence(String(nextSettings.minOpportunityConfidence));
    setMinPrice(String(nextSettings.minPrice));
    setMaxPrice(String(nextSettings.maxPrice));
    setMinAvgDailyVolume(String(nextSettings.minAvgDailyVolume));
    setMaxMarketCapUsd(String(nextSettings.maxMarketCapUsd));
    setMaxIpoAgeDays(String(nextSettings.maxIpoAgeDays));
    setMaxBidNotional(String(nextSettings.maxBidNotional));
    setMaxPositionNotionalPerSymbol(String(nextSettings.maxPositionNotionalPerSymbol));
  }

  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <span>Emerging / IPO Lane</span>
          <h2>Discovery Options</h2>
        </div>
      </div>
      <div className="panelBody stack">
        <div className="emergingControlGrid">
          <label className="fieldGroup emergingWideField">
            <span>Seed symbols</span>
            <textarea
              onChange={(event) => setSeedSymbols(event.target.value.toUpperCase())}
              placeholder="IONQ, SOUN, RKLB"
              value={seedSymbols}
            />
          </label>
          <label className="checkField">
            <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
            <span>Enabled</span>
          </label>
          <NumberField label="Max symbols" min="1" value={maxSymbols} onChange={setMaxSymbols} />
          <NumberField label="News lookback hours" min="1" value={newsLookbackHours} onChange={setNewsLookbackHours} />
          <NumberField label="News limit" min="1" max="50" value={newsLimit} onChange={setNewsLimit} />
          <NumberField
            label="Min confidence"
            min="0"
            max="1"
            step="0.01"
            value={minOpportunityConfidence}
            onChange={setMinOpportunityConfidence}
          />
          <MoneyField label="Min price" value={minPrice} onChange={setMinPrice} />
          <MoneyField label="Max price" value={maxPrice} onChange={setMaxPrice} />
          <NumberField label="Min avg volume" min="0" value={minAvgDailyVolume} onChange={setMinAvgDailyVolume} />
          <MoneyField label="Max market cap" value={maxMarketCapUsd} onChange={setMaxMarketCapUsd} />
          <NumberField label="Max IPO age days" min="1" value={maxIpoAgeDays} onChange={setMaxIpoAgeDays} />
          <MoneyField label="Max bid" value={maxBidNotional} onChange={setMaxBidNotional} />
          <MoneyField
            label="Max holding"
            value={maxPositionNotionalPerSymbol}
            onChange={setMaxPositionNotionalPerSymbol}
          />
        </div>
        <div className="controls">
          <button className="iconButton primary" disabled={isPending} onClick={saveSettings} type="button">
            <Save size={16} />
            {isPending ? "Working" : "Save Options"}
          </button>
          <button className="iconButton" disabled={isPending} onClick={recommendSettings} type="button">
            <Sparkles size={16} />
            Recommend Options
          </button>
          <button className="iconButton" disabled={isPending || !settings.enabled} onClick={runDiscovery} type="button">
            <Radar size={16} />
            Run Discovery
          </button>
        </div>
        {message ? <div className="statusMessage">{message}</div> : null}
        {recommendationReasons.length > 0 ? (
          <ul className="recommendationList">
            {recommendationReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
        {discoveryCandidates.length > 0 ? (
          <div className="sourceLinks">
            {discoveryCandidates.slice(0, 6).map((candidate) => (
              <a href={candidate.sourceUrl} key={`${candidate.symbol}-${candidate.sourceUrl}`} rel="noreferrer" target="_blank">
                {candidate.symbol} {candidate.score.toFixed(2)}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function NumberField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <label className="fieldGroup">
      <span>{props.label}</span>
      <input
        className="plainInput"
        inputMode="decimal"
        max={props.max}
        min={props.min}
        onChange={(event) => props.onChange(event.target.value)}
        step={props.step ?? "1"}
        type="number"
        value={props.value}
      />
    </label>
  );
}

function MoneyField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="fieldGroup">
      <span>{props.label}</span>
      <div className="moneyInput">
        <span>$</span>
        <input
          inputMode="decimal"
          min="1"
          onChange={(event) => props.onChange(event.target.value)}
          step="1"
          type="number"
          value={props.value}
        />
      </div>
    </label>
  );
}
