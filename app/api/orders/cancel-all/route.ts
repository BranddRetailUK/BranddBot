import { NextResponse } from "next/server";
import { AlpacaBroker } from "@/lib/broker/alpaca";

export async function POST() {
  const broker = new AlpacaBroker();
  const health = await broker.healthCheck();

  if (!health.ok) {
    return NextResponse.json({ error: health.message }, { status: 400 });
  }

  await broker.cancelAllOrders();
  return NextResponse.json({ message: "All open Alpaca paper orders were cancelled." });
}
