import { formatDistanceToNow } from "date-fns";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HealthStatus = "ok" | "warning" | "critical" | "unknown";

const statusClasses: Record<HealthStatus, string> = {
  ok: "bg-green-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
  unknown: "bg-gray-400",
};

export function HealthCard({
  label,
  value,
  status,
  lastCheckedAt,
  trend,
}: {
  label: string;
  value: string;
  status: HealthStatus;
  lastCheckedAt?: Date;
  trend?: "up" | "down";
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardDescription>{label}</CardDescription>
          <span className={cn("h-2.5 w-2.5 rounded-full", statusClasses[status])} />
        </div>
        <CardTitle className="flex items-center gap-2 text-2xl">
          {value}
          {trend === "up" ? <ArrowUp className="h-4 w-4 text-red-600" /> : null}
          {trend === "down" ? <ArrowDown className="h-4 w-4 text-green-600" /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          {lastCheckedAt
            ? `Checked ${formatDistanceToNow(lastCheckedAt, { addSuffix: true })}`
            : "No checks yet"}
        </p>
      </CardContent>
    </Card>
  );
}
