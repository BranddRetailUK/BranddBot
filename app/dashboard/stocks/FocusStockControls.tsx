"use client";

import { Crosshair, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function FocusSymbolButton({ symbol, initialFocused }: { symbol: string; initialFocused: boolean }) {
  const router = useRouter();
  const [focused, setFocused] = useState(initialFocused);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleFocus() {
    const nextFocused = !focused;
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/focus-symbols", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, focused: nextFocused })
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          setMessage(payload.error ?? "Focus update failed.");
          return;
        }
        setFocused(nextFocused);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Focus update failed.");
      }
    });
  }

  return (
    <div className="focusAction">
      <button
        className={focused ? "iconButton primary compactButton" : "iconButton compactButton"}
        disabled={isPending}
        onClick={toggleFocus}
        title={focused ? `Remove ${symbol} from focused research` : `Focus research on ${symbol}`}
        type="button"
      >
        <Crosshair size={15} />
        {focused ? "Focused" : "Focus"}
      </button>
      {message ? <span className="negative">{message}</span> : null}
    </div>
  );
}

export function FocusSymbolForm() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function addFocusedSymbol() {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/focus-symbols", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, focused: true })
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          setMessage(payload.error ?? "Focus update failed.");
          return;
        }
        setSymbol("");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Focus update failed.");
      }
    });
  }

  return (
    <div className="focusForm">
      <input
        aria-label="Symbol to focus"
        onChange={(event) => setSymbol(event.target.value.toUpperCase())}
        onKeyDown={(event) => {
          if (event.key === "Enter") addFocusedSymbol();
        }}
        placeholder="SYMBOL"
        type="text"
        value={symbol}
      />
      <button className="iconButton primary compactButton" disabled={isPending || !symbol.trim()} onClick={addFocusedSymbol} type="button">
        <Plus size={15} />
        Focus
      </button>
      {message ? <span className="negative">{message}</span> : null}
    </div>
  );
}
