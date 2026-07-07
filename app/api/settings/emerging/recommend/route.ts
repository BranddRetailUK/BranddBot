import { NextResponse } from "next/server";
import { recommendEmergingSettings } from "@/lib/emerging/recommendations";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { save?: unknown };

  try {
    const recommendation = await recommendEmergingSettings({ save: body.save === true });
    return NextResponse.json({ recommendation });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Emerging recommendation failed."
      },
      { status: 500 }
    );
  }
}
