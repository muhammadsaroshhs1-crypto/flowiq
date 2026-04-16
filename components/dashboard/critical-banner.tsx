import Link from "next/link";
import type { Alert } from "@prisma/client";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CriticalBanner({
  criticalCount,
  alerts,
}: {
  criticalCount: number;
  alerts: Alert[];
}) {
  if (criticalCount <= 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-950">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <Bell className="mt-0.5 h-5 w-5" />
          <div>
            <p className="font-semibold">{criticalCount} critical alerts need attention</p>
            <div className="mt-2 space-y-2">
              {alerts.slice(0, 2).map((alert) => (
                <div key={alert.id} className="text-sm">
                  <p className="font-medium">{alert.title}</p>
                  {alert.actionRequired ? <p>{alert.actionRequired}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
        <Button render={<Link href="/alerts?severity=CRITICAL" />} variant="outline">
          Fix now
        </Button>
      </div>
    </div>
  );
}
