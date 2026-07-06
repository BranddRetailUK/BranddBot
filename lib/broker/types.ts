import type {
  AccountSnapshot,
  BrokerOrderSnapshot,
  MarketBar,
  OrderRequest,
  OrderResult,
  PositionSnapshot,
  TradeFillActivity
} from "@/lib/types/trading";

export interface BrokerAdapter {
  getAccount(): Promise<AccountSnapshot>;
  getPositions(): Promise<PositionSnapshot[]>;
  getBars(symbols: string[], timeframe: string, limit: number): Promise<Record<string, MarketBar[]>>;
  submitOrder(order: OrderRequest): Promise<OrderResult>;
  getOrder(orderId: string): Promise<BrokerOrderSnapshot>;
  getFillActivities(options?: { after?: Date; until?: Date; symbols?: string[] }): Promise<TradeFillActivity[]>;
  cancelAllOrders(): Promise<void>;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}
