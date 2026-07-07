import { NextResponse } from "next/server";
import { getEmergingSettings, setEmergingSettings } from "@/lib/emerging/settings";
import type { EmergingResearchSettings } from "@/lib/types/trading";

export async function GET() {
  return NextResponse.json({ settings: await getEmergingSettings() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<EmergingResearchSettings>;

  try {
    const settings = await setEmergingSettings(body);
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Emerging settings update failed."
      },
      { status: 400 }
    );
  }
}
