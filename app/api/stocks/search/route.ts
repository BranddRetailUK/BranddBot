import { NextResponse } from "next/server";
import { searchStockAssets } from "@/lib/market/assets";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 20);

  try {
    const assets = await searchStockAssets({ query, limit: Number.isFinite(limit) ? limit : 20 });
    return NextResponse.json({ assets });
  } catch (error) {
    return NextResponse.json(
      {
        assets: [],
        error: error instanceof Error ? error.message : "Stock search failed."
      },
      { status: 500 }
    );
  }
}
