import type { AccountSnapshot, MarketBar, OrderRequest, OrderResult, PositionSnapshot } from "@/lib/types/trading";

export interface BrokerAdapter {
  getAccount(): Promise<AccountSnapshot>;
  getPositions(): Promise<PositionSnapshot[]>;
  getBars(symbols: string[], timeframe: string, limit: number): Promise<Record<string, MarketBar[]>>;
  submitOrder(order: OrderRequest): Promise<OrderResult>;
  cancelAllOrders(): Promise<void>;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}
