"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const checkTypes = [
  "UPTIME_CHECK",
  "SSL_CHECK",
  "CWV_CHECK",
  "LINK_CHECK",
  "FORM_CHECK",
] as const;

export function ManualCheckForm({ projectId }: { projectId: string }) {
  const [checkType, setCheckType] = useState<(typeof checkTypes)[number]>("UPTIME_CHECK");
  const [isQueueing, setIsQueueing] = useState(false);

  async function queueCheck() {
    setIsQueueing(true);

    try {
      const response = await fetch("/api/monitoring/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, checkType }),
      });
      const data = (await response.json()) as { message?: string; error?: string };

      if (!response.ok || data.error) {
        toast.error(data.error ?? "Could not queue check");
        return;
      }

      toast.success(data.message ?? "Check queued");
    } catch {
      toast.error("Could not queue check");
    } finally {
      setIsQueueing(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={checkType}
        onChange={(event) => setCheckType(event.target.value as typeof checkType)}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        {checkTypes.map((type) => (
          <option key={type} value={type}>
            {type.replaceAll("_", " ").toLowerCase()}
          </option>
        ))}
      </select>
      <Button onClick={queueCheck} disabled={isQueueing}>
        {isQueueing ? "Queueing..." : "Run check"}
      </Button>
    </div>
  );
}
