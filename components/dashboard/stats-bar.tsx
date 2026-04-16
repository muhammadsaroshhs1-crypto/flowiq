import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DashboardStats = {
  activeProjects: number;
  criticalAlerts: number;
  pendingSuggestions: number;
  socialPendingReview: number;
};

const statItems: Array<{
  key: keyof DashboardStats;
  label: string;
  critical?: boolean;
}> = [
  { key: "activeProjects", label: "Active projects" },
  { key: "criticalAlerts", label: "Open critical alerts", critical: true },
  { key: "pendingSuggestions", label: "Pending suggestions" },
  { key: "socialPendingReview", label: "Social posts pending review" },
];

export function StatsBar({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {statItems.map((item) => (
        <Card key={item.key} className="rounded-lg">
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle
              className={cn("text-3xl", item.critical && stats[item.key] > 0 ? "text-red-600" : "")}
            >
              {stats[item.key]}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
