import type { BrokerAdapter } from "@/lib/broker/types";
import type {
  AccountSnapshot,
  BrokerOrderSnapshot,
  MarketBar,
  OrderRequest,
  OrderResult,
  PositionSnapshot,
  TradeFillActivity
} from "@/lib/types/trading";

export class MockBroker implements BrokerAdapter {
  readonly orders: OrderResult[] = [];
  account: AccountSnapshot = {
    id: "mock-paper",
    status: "ACTIVE",
    currency: "USD",
    buyingPower: 1000,
    cash: 1000,
    portfolioValue: 1000
  };
  positions: PositionSnapshot[] = [];
  bars: Record<string, MarketBar[]> = {};

  async getAccount(): Promise<AccountSnapshot> {
    return this.account;
  }

  async getPositions(): Promise<PositionSnapshot[]> {
    return this.positions;
  }

  async getBars(symbols: string[]): Promise<Record<string, MarketBar[]>> {
    return Object.fromEntries(symbols.map((symbol) => [symbol, this.bars[symbol] ?? []]));
  }

  async submitOrder(order: OrderRequest): Promise<OrderResult> {
    const result: OrderResult = {
      id: `mock-order-${this.orders.length + 1}`,
      symbol: order.symbol,
      side: order.side,
      status: "accepted",
      notional: order.notional,
      qty: order.qty,
      filledAvgPrice: this.bars[order.symbol]?.at(-1)?.close
    };
    this.orders.push(result);
    return result;
  }

  async getOrder(orderId: string): Promise<BrokerOrderSnapshot> {
    const order = this.orders.find((item) => item.id === orderId);
    if (!order) {
      throw new Error(`Mock order ${orderId} was not found.`);
    }

    return {
      ...order,
      status: "filled",
      filledAt: new Date().toISOString()
    };
  }

  async getFillActivities(): Promise<TradeFillActivity[]> {
    return this.orders
      .filter((order) => order.status === "filled" || order.status === "accepted")
      .map((order, index) => ({
        id: `mock-fill-${index + 1}`,
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        qty: order.qty ?? (order.notional && order.filledAvgPrice ? order.notional / order.filledAvgPrice : 0),
        price: order.filledAvgPrice ?? 0,
        transactionTime: new Date().toISOString()
      }));
  }

  async cancelAllOrders(): Promise<void> {
    this.orders.length = 0;
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: "Mock broker is ready." };
  }
}
