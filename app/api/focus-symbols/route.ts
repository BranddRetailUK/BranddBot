import { NextResponse } from "next/server";
import { getFocusedSymbols, setFocusedSymbols, setSymbolFocused } from "@/lib/db/focusSymbols";

export async function GET() {
  return NextResponse.json({ symbols: await getFocusedSymbols() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    symbol?: unknown;
    focused?: unknown;
    symbols?: unknown;
  };

  try {
    if (Array.isArray(body.symbols)) {
      return NextResponse.json({ symbols: await setFocusedSymbols(body.symbols.map(String)) });
    }

    if (typeof body.symbol !== "string" || typeof body.focused !== "boolean") {
      return NextResponse.json({ error: "Send either { symbols } or { symbol, focused }." }, { status: 400 });
    }

    return NextResponse.json({ symbols: await setSymbolFocused(body.symbol, body.focused) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Focused symbol update failed."
      },
      { status: 400 }
    );
  }
}
