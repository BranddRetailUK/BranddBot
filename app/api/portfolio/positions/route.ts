import { NextResponse } from "next/server";
import { getPortfolioPositions } from "@/lib/portfolio/positions";

export async function GET() {
  try {
    return NextResponse.json(await getPortfolioPositions());
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Portfolio positions failed.",
        generatedAt: new Date().toISOString(),
        totalMarketValue: 0,
        positions: []
      },
      { status: 500 }
    );
  }
}
