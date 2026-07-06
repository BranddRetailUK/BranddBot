import Alpaca from "@alpacahq/alpaca-trade-api";
import { getEnv, isAlpacaConfigured, type AppEnv } from "@/lib/config/env";
import type { BrokerAdapter } from "@/lib/broker/types";
import type { AccountSnapshot, MarketBar, OrderRequest, OrderResult, PositionSnapshot } from "@/lib/types/trading";

type AlpacaClient = {
  getAccount: () => Promise<Record<string, unknown>>;
  getPositions: () => Promise<Array<Record<string, unknown>>>;
  createOrder: (order: Record<string, unknown>) => Promise<Record<string, unknown>>;
  cancelAllOrders: () => Promise<unknown>;
};

export class AlpacaBroker implements BrokerAdapter {
  private readonly env: AppEnv;
  private readonly client?: AlpacaClient;

  constructor(env = getEnv()) {
    this.env = env;
    this.client = this.createClient();
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    if (!this.client || !isAlpacaConfigured(this.env)) {
      return { ok: false, message: "Alpaca paper credentials are not configured." };
    }

    try {
      const account = await this.client.getAccount();
      return {
        ok: true,
        message: `Connected to Alpaca account ${String(account.id ?? "unknown")} (${String(account.status ?? "unknown")}).`
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Alpaca health check failed."
      };
    }
  }

  async getAccount(): Promise<AccountSnapshot> {
    const client = this.getClient();
    const account = await client.getAccount();

    return {
      id: toOptionalString(account.id),
      status: toOptionalString(account.status),
      currency: toOptionalString(account.currency),
      buyingPower: toNumber(account.buying_power),
      cash: toNumber(account.cash),
      portfolioValue: toNumber(account.portfolio_value)
    };
  }

  async getPositions(): Promise<PositionSnapshot[]> {
    const client = this.getClient();
    const positions = await client.getPositions();

    return positions.map((position) => ({
      symbol: String(position.symbol),
      qty: toNumber(position.qty),
      marketValue: toNumber(position.market_value),
      avgEntryPrice: toNumber(position.avg_entry_price),
      unrealizedPnl: toNumber(position.unrealized_pl)
    }));
  }

  async getBars(symbols: string[], timeframe: string, limit: number): Promise<Record<string, MarketBar[]>> {
    this.getClient();
    if (symbols.length === 0) return {};

    const url = new URL("/v2/stocks/bars", this.env.ALPACA_DATA_BASE_URL);
    url.searchParams.set("symbols", symbols.join(","));
    url.searchParams.set("timeframe", timeframe);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("adjustment", "raw");
    url.searchParams.set("feed", "iex");

    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": this.env.APCA_API_KEY_ID,
        "APCA-API-SECRET-KEY": this.env.APCA_API_SECRET_KEY
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Alpaca market data request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as {
      bars?: Record<
        string,
        Array<{
          t: string;
          o: number;
          h: number;
          l: number;
          c: number;
          v: number;
        }>
      >;
    };

    const result: Record<string, MarketBar[]> = {};
    for (const symbol of symbols) {
      result[symbol] = (payload.bars?.[symbol] ?? []).map((bar) => ({
        timestamp: bar.t,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v
      }));
    }

    return result;
  }

  async submitOrder(order: OrderRequest): Promise<OrderResult> {
    const client = this.getClient();
    const response = await client.createOrder({
      symbol: order.symbol,
      side: order.side,
      type: order.type ?? "market",
      time_in_force: order.timeInForce ?? "day",
      qty: order.qty,
      notional: order.notional,
      client_order_id: order.clientOrderId
    });

    return {
      id: String(response.id),
      symbol: String(response.symbol),
      side: order.side,
      status: String(response.status),
      qty: toOptionalNumber(response.qty),
      notional: toOptionalNumber(response.notional),
      filledAvgPrice: toOptionalNumber(response.filled_avg_price)
    };
  }

  async cancelAllOrders(): Promise<void> {
    const client = this.getClient();
    await client.cancelAllOrders();
  }

  private createClient(): AlpacaClient | undefined {
    if (!isAlpacaConfigured(this.env)) return undefined;
    const AlpacaCtor = Alpaca as unknown as new (options: Record<string, unknown>) => AlpacaClient;
    return new AlpacaCtor({
      keyId: this.env.APCA_API_KEY_ID,
      secretKey: this.env.APCA_API_SECRET_KEY,
      paper: this.env.APCA_API_BASE_URL.includes("paper"),
      baseUrl: this.env.APCA_API_BASE_URL
    });
  }

  private getClient(): AlpacaClient {
    if (!this.client || !isAlpacaConfigured(this.env)) {
      throw new Error("Alpaca credentials are not configured. Add APCA_API_KEY_ID and APCA_API_SECRET_KEY to .env.");
    }
    return this.client;
  }
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return toNumber(value);
}

function toOptionalString(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}
