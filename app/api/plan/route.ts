import { NextResponse } from "next/server";
import { buildTradePlan, getLatestTradePlan } from "@/lib/plan/builder";

export async function GET() {
  const plan = await getLatestTradePlan();
  return NextResponse.json({ plan });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { maxItems?: number };

  try {
    const plan = await buildTradePlan({ maxItems: body.maxItems });
    return NextResponse.json({
      message: `Trade plan generated with ${plan.items.length} candidate item(s).`,
      plan
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Trade plan generation failed."
      },
      { status: 500 }
    );
  }
}
