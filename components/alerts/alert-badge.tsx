"use client";

import Link from "next/link";

import { useAlerts } from "@/hooks/use-alerts";

export function AlertBadge() {
  const { stats } = useAlerts({ limit: 1 });

  return (
    <Link
      href="/alerts"
      className="relative rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
    >
      Alerts
      {stats.critical > 0 ? (
        <span className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 py-0.5 text-xs text-white">
          {stats.critical}
        </span>
      ) : null}
    </Link>
  );
}
