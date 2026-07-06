import type { BrokerAdapter } from "@/lib/broker/types";
import type { AccountSnapshot, MarketBar, OrderRequest, OrderResult, PositionSnapshot } from "@/lib/types/trading";

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

  async cancelAllOrders(): Promise<void> {
    this.orders.length = 0;
  }

  async healthCheck(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: "Mock broker is ready." };
  }
}
