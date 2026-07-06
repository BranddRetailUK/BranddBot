"use client";

import { Search, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { OrderResult, StockAsset } from "@/lib/types/trading";

export function StockSearchBuy({ defaultNotional }: { defaultNotional: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<StockAsset[]>([]);
  const [notionalBySymbol, setNotionalBySymbol] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [buyingSymbol, setBuyingSymbol] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(trimmed)}&limit=12`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as { assets?: StockAsset[]; error?: string };
        if (!active) return;
        if (!response.ok) {
          setMessage(payload.error ?? "Stock search failed.");
          setAssets([]);
          return;
        }
        setAssets(payload.assets ?? []);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Stock search failed.");
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  function updateNotional(symbol: string, value: string) {
    setNotionalBySymbol((current) => ({ ...current, [symbol]: value }));
  }

  function updateQuery(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setAssets([]);
      setMessage("");
      setLoading(false);
    }
  }

  function buy(asset: StockAsset) {
    const notional = Number(notionalBySymbol[asset.symbol] ?? defaultNotional);
    setMessage("");
    setBuyingSymbol(asset.symbol);

    startTransition(async () => {
      try {
        const response = await fetch("/api/orders/manual-buy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: asset.symbol, notional })
        });
        const payload = (await response.json()) as { message?: string; error?: string; order?: OrderResult };
        setMessage(payload.message ?? payload.error ?? "Manual paper buy finished.");
        if (response.ok) router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Manual paper buy failed.");
      } finally {
        setBuyingSymbol(undefined);
      }
    });
  }

  return (
    <section className="panel stockSearchPanel">
      <div className="panelHeader">
        <div>
          <span>Search</span>
          <h2>Manual Paper Buy</h2>
        </div>
      </div>
      <div className="panelBody stack">
        <div className="searchInputWrap">
          <Search size={17} />
          <input
            aria-label="Search stocks by ticker or company name"
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search ticker or company name"
            type="search"
            value={query}
          />
        </div>
        <p className="sectionIntro">
          Manual buys are user-submitted Alpaca paper market orders. They do not come from the bot and stay blocked unless
          paper-only safety checks pass.
        </p>
        {message ? <div className="statusMessage">{message}</div> : null}
        {loading ? <div className="muted">Searching...</div> : null}
        {assets.length > 0 ? (
          <div className="assetResults">
            {assets.map((asset) => {
              const canBuy = asset.tradable && asset.fractionable;
              return (
                <div className="assetResultRow" key={asset.symbol}>
                  <div>
                    <strong>{asset.symbol}</strong>
                    <span>{asset.name}</span>
                    <small>
                      {[asset.exchange, asset.tradable ? "tradable" : "not tradable", asset.fractionable ? "fractionable" : "whole-share only"]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </div>
                  <label className="compactMoneyInput">
                    <span>$</span>
                    <input
                      aria-label={`${asset.symbol} manual buy notional`}
                      inputMode="decimal"
                      min="1"
                      onChange={(event) => updateNotional(asset.symbol, event.target.value)}
                      step="1"
                      type="number"
                      value={notionalBySymbol[asset.symbol] ?? String(defaultNotional)}
                    />
                  </label>
                  <button
                    className="iconButton primary compactButton"
                    disabled={!canBuy || isPending || buyingSymbol === asset.symbol}
                    onClick={() => buy(asset)}
                    title={canBuy ? `Submit a manual paper buy for ${asset.symbol}` : "Notional buys require tradable fractionable assets"}
                    type="button"
                  >
                    <ShoppingCart size={15} />
                    {buyingSymbol === asset.symbol ? "Buying" : "Buy"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
