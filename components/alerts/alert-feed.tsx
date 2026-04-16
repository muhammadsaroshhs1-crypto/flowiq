"use client";

import { useState } from "react";
import type { AlertCategory, AlertSeverity } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAlerts } from "@/hooks/use-alerts";
import { cn } from "@/lib/utils";

type AlertFeedProps = {
  projectId?: string;
  limit?: number;
  showFilters?: boolean;
};

const severityClasses = {
  CRITICAL: "bg-red-500",
  WARNING: "bg-amber-500",
  INFO: "bg-green-500",
};

const categories: Array<AlertCategory | "all"> = ["all", "SEO", "AMAZON", "WEBSITE", "SOCIAL", "BILLING", "SYSTEM"];
const severities: Array<AlertSeverity | "all"> = ["all", "CRITICAL", "WARNING", "INFO"];

export function AlertFeed({ projectId, limit = 50, showFilters = true }: AlertFeedProps) {
  const [severity, setSeverity] = useState<AlertSeverity | "all">("all");
  const [category, setCategory] = useState<AlertCategory | "all">("all");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const { alerts, isLoading, resolve } = useAlerts({
    projectId,
    limit,
    severity,
    category,
  });
  const selectedAlert = alerts.find((alert) => alert.id === selectedAlertId);

  return (
    <div className="space-y-4">
      {showFilters ? (
        <div className="flex flex-wrap gap-3 rounded-lg border bg-background p-3">
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value as AlertSeverity | "all")}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {severities.map((item) => (
              <option key={item} value={item}>{item === "all" ? "All severities" : item}</option>
            ))}
          </select>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as AlertCategory | "all")}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {categories.map((item) => (
              <option key={item} value={item}>{item === "all" ? "All categories" : item}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-3">
        {isLoading ? (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading alerts...</div>
        ) : alerts.length ? (
          alerts.map((alert) => (
            <div key={alert.id} className="rounded-lg border bg-background p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setSelectedAlertId(alert.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn("h-2.5 w-2.5 rounded-full", severityClasses[alert.severity])} />
                    <p className="truncate font-medium">{alert.title}</p>
                    <Badge variant="outline">{alert.category}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                    {alert.project?.name ? `${alert.project.name} · ` : ""}
                    {alert.message}
                  </p>
                </button>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => resolve(alert.id)}>
                    Resolve
                  </Button>
                  <Button size="sm" onClick={() => setSelectedAlertId(alert.id)}>
                    View
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No alerts match these filters.
          </div>
        )}
      </div>

      <Sheet open={Boolean(selectedAlert)} onOpenChange={(open) => !open && setSelectedAlertId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selectedAlert ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedAlert.title}</SheetTitle>
                <SheetDescription>
                  {selectedAlert.project?.name ?? "Workspace"} · {selectedAlert.category}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{selectedAlert.severity}</Badge>
                  <Badge variant="outline">{selectedAlert.category}</Badge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{selectedAlert.message}</p>
                {selectedAlert.actionRequired ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-950">
                    {selectedAlert.actionRequired}
                  </div>
                ) : null}
                {selectedAlert.metadata ? (
                  <details className="rounded-lg border p-3 text-sm">
                    <summary className="cursor-pointer font-medium">Technical details</summary>
                    <pre className="mt-3 overflow-auto text-xs">
                      {JSON.stringify(selectedAlert.metadata, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
              <SheetFooter>
                <Button onClick={() => resolve(selectedAlert.id)}>Resolve</Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
