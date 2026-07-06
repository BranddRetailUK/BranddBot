"use client";

import { AlertTriangle, PauseCircle, Play, RefreshCw, Shield, XCircle } from "lucide-react";
import { useState, useTransition } from "react";

export function BotControls({ enabled }: { enabled: boolean }) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function runAction(label: string, action: () => Promise<Response>) {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await action();
        const payload = (await response.json()) as { message?: string; error?: string };
        setMessage(payload.message ?? payload.error ?? `${label} finished.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : `${label} failed.`);
      }
    });
  }

  return (
    <div>
      <div className="controls">
        <button
          className="iconButton primary"
          disabled={isPending || enabled}
          onClick={() =>
            runAction("Enable bot", () =>
              fetch("/api/bot/toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: true })
              })
            )
          }
          title="Enable scheduled paper scans"
        >
          <Play size={16} /> Enable
        </button>
        <button
          className="iconButton"
          disabled={isPending || !enabled}
          onClick={() =>
            runAction("Disable bot", () =>
              fetch("/api/bot/toggle", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: false })
              })
            )
          }
          title="Disable scheduled scans"
        >
          <PauseCircle size={16} /> Disable
        </button>
        <button
          className="iconButton"
          disabled={isPending}
          onClick={() =>
            runAction("Dry scan", () =>
              fetch("/api/bot/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dryRun: true })
              })
            )
          }
          title="Run a scan without placing paper orders"
        >
          <RefreshCw size={16} /> Dry Scan
        </button>
        <button
          className="iconButton"
          disabled={isPending}
          onClick={() =>
            runAction("Paper scan", () =>
              fetch("/api/bot/scan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dryRun: false })
              })
            )
          }
          title="Run one paper-trading scan"
        >
          <AlertTriangle size={16} /> Paper Scan
        </button>
        <button
          className="iconButton danger"
          disabled={isPending}
          onClick={() => runAction("Cancel orders", () => fetch("/api/orders/cancel-all", { method: "POST" }))}
          title="Cancel all open Alpaca paper orders"
        >
          <XCircle size={16} /> Cancel Orders
        </button>
        <button
          className="iconButton danger"
          disabled={isPending}
          onClick={() => runAction("Emergency stop", () => fetch("/api/bot/emergency-stop", { method: "POST" }))}
          title="Disable the bot and cancel open orders"
        >
          <Shield size={16} /> Stop
        </button>
      </div>
      {message ? <div className="statusMessage">{message}</div> : null}
    </div>
  );
}
