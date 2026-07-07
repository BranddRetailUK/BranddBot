import { NextResponse } from "next/server";
import { runEmergingDiscovery } from "@/lib/emerging/discovery";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { saveSymbols?: unknown };

  try {
    const result = await runEmergingDiscovery({ saveSymbols: body.saveSymbols === true });
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Emerging discovery failed."
      },
      { status: 500 }
    );
  }
}
