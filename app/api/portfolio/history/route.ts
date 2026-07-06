import { NextResponse } from "next/server";
import { getPortfolioHistory } from "@/lib/portfolio/snapshots";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rangeHours = Number(url.searchParams.get("rangeHours") ?? "24");

  try {
    const result = await getPortfolioHistory({
      rangeHours: Number.isFinite(rangeHours) ? rangeHours : 24,
      refresh: true,
      minIntervalSeconds: 10
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Portfolio history failed."
      },
      { status: 500 }
    );
  }
}
