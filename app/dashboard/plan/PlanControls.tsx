"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function PlanControls() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function generatePlan() {
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/plan", { method: "POST" });
        const payload = (await response.json()) as { message?: string; error?: string };
        setMessage(payload.message ?? payload.error ?? "Trade plan generation finished.");
        if (response.ok) router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Trade plan generation failed.");
      }
    });
  }

  return (
    <div>
      <button className="iconButton primary" disabled={isPending} onClick={generatePlan} title="Generate a new advisory trade plan">
        <RefreshCw size={16} /> Generate Plan
      </button>
      {message ? <div className="statusMessage">{message}</div> : null}
    </div>
  );
}
