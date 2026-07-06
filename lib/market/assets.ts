import { getEnv, isAlpacaConfigured, type AppEnv } from "@/lib/config/env";
import type { StockAsset } from "@/lib/types/trading";

const ASSET_CACHE_MS = 10 * 60 * 1000;

let cachedAssets: { fetchedAt: number; assets: StockAsset[] } | undefined;

type AlpacaAssetPayload = {
  symbol?: string;
  name?: string;
  exchange?: string;
  class?: string;
  asset_class?: string;
  status?: string;
  tradable?: boolean;
  fractionable?: boolean;
};

export async function searchStockAssets(params: {
  query: string;
  limit?: number;
  env?: AppEnv;
}): Promise<StockAsset[]> {
  const query = params.query.trim().toUpperCase();
  const limit = Math.min(50, Math.max(1, Math.floor(params.limit ?? 20)));
  if (!query) return [];

  const assets = await getStockAssets(params.env);
  return assets
    .map((asset) => ({
      asset,
      rank: rankAssetMatch(asset, query)
    }))
    .filter((item) => item.rank > 0)
    .sort((left, right) => {
      const rankDiff = right.rank - left.rank;
      if (rankDiff !== 0) return rankDiff;
      return left.asset.symbol.localeCompare(right.asset.symbol);
    })
    .slice(0, limit)
    .map((item) => item.asset);
}

export async function getStockAsset(symbol: string, env?: AppEnv): Promise<StockAsset | undefined> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) return undefined;
  const assets = await getStockAssets(env);
  return assets.find((asset) => asset.symbol === normalized);
}

export async function getStockAssets(env = getEnv()): Promise<StockAsset[]> {
  if (cachedAssets && Date.now() - cachedAssets.fetchedAt < ASSET_CACHE_MS) {
    return cachedAssets.assets;
  }

  if (!isAlpacaConfigured(env)) {
    throw new Error("Alpaca paper credentials are not configured.");
  }

  const url = new URL("/v2/assets", env.APCA_API_BASE_URL);
  url.searchParams.set("status", "active");
  url.searchParams.set("asset_class", "us_equity");

  const response = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": env.APCA_API_KEY_ID,
      "APCA-API-SECRET-KEY": env.APCA_API_SECRET_KEY
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Alpaca asset search failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as unknown;
  const rows = Array.isArray(payload) ? payload : [];
  const assets = rows
    .map(mapAsset)
    .filter((asset): asset is StockAsset => Boolean(asset))
    .sort((left, right) => left.symbol.localeCompare(right.symbol));

  cachedAssets = { fetchedAt: Date.now(), assets };
  return assets;
}

function mapAsset(asset: unknown): StockAsset | undefined {
  if (!asset || typeof asset !== "object") return undefined;
  const row = asset as AlpacaAssetPayload;
  const symbol = row.symbol?.trim().toUpperCase();
  const name = row.name?.trim();
  if (!symbol || !name) return undefined;

  return {
    symbol,
    name,
    exchange: row.exchange,
    assetClass: row.asset_class ?? row.class,
    status: row.status,
    tradable: row.tradable === true,
    fractionable: row.fractionable === true
  };
}

function rankAssetMatch(asset: StockAsset, query: string): number {
  const symbol = asset.symbol.toUpperCase();
  const name = asset.name.toUpperCase();

  if (symbol === query) return 100;
  if (symbol.startsWith(query)) return 80;
  if (name === query) return 70;
  if (name.startsWith(query)) return 60;
  if (symbol.includes(query)) return 45;
  if (name.includes(query)) return 35;
  return 0;
}
