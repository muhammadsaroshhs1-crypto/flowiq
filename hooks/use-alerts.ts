"use client";

import type { Alert, AlertCategory, AlertSeverity } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type AlertWithProject = Alert & {
  project?: { id: string; name: string } | null;
};

type AlertStats = {
  critical: number;
  warning: number;
  info: number;
  totalUnread: number;
};

type AlertFilters = {
  projectId?: string;
  limit?: number;
  showResolved?: boolean;
  severity?: AlertSeverity | "all";
  category?: AlertCategory | "all";
};

export function useAlerts(filters: AlertFilters = {}) {
  const [alerts, setAlerts] = useState<AlertWithProject[]>([]);
  const [stats, setStats] = useState<AlertStats>({
    critical: 0,
    warning: 0,
    info: 0,
    totalUnread: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    const params = new URLSearchParams({
      limit: String(filters.limit ?? 50),
      isResolved: filters.showResolved ? "all" : "false",
      severity: filters.severity ?? "all",
      category: filters.category ?? "all",
      projectId: filters.projectId ?? "all",
    });

    try {
      const response = await fetch(`/api/alerts?${params.toString()}`);
      const data = (await response.json()) as {
        alerts?: AlertWithProject[];
        stats?: AlertStats;
        error?: string;
      };

      if (!response.ok || data.error) {
        toast.error(data.error ?? "Could not load alerts");
        return;
      }

      setAlerts(data.alerts ?? []);
      if (data.stats) setStats(data.stats);
    } finally {
      setIsLoading(false);
    }
  }, [filters.category, filters.limit, filters.projectId, filters.severity, filters.showResolved]);

  async function patchAlert(alertId: string, action: "read" | "resolve") {
    const response = await fetch(`/api/alerts/${alertId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok || data.error) {
      toast.error(data.error ?? "Could not update alert");
      return;
    }

    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const source = new EventSource("/api/alerts/sse");

    source.addEventListener("alert", (event) => {
      const alert = JSON.parse((event as MessageEvent).data) as AlertWithProject;
      setAlerts((current) => [alert, ...current]);
      setStats((current) => ({
        ...current,
        critical: alert.severity === "CRITICAL" ? current.critical + 1 : current.critical,
        warning: alert.severity === "WARNING" ? current.warning + 1 : current.warning,
        totalUnread: current.totalUnread + 1,
      }));
      toast.warning(alert.title);
    });

    return () => {
      source.close();
    };
  }, []);

  return {
    alerts,
    stats,
    isLoading,
    markAsRead: (alertId: string) => patchAlert(alertId, "read"),
    resolve: (alertId: string) => patchAlert(alertId, "resolve"),
    refresh,
  };
}
