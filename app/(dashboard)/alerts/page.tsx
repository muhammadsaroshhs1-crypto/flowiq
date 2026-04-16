import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AlertFeed } from "@/components/alerts/alert-feed";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAlertStats } from "@/services/alert-service";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const workspace = await getCurrentWorkspace(userId);

  if (!workspace) {
    redirect("/onboarding");
  }

  const [stats, resolvedToday] = await Promise.all([
    getAlertStats(workspace.id),
    prisma.alert.count({
      where: {
        workspaceId: workspace.id,
        isResolved: true,
        resolvedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
  ]);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Unified feed</p>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Critical alerts" value={stats.critical} tone="text-red-600" />
        <StatCard label="Warnings" value={stats.warning} tone="text-amber-600" />
        <StatCard label="Resolved today" value={resolvedToday} tone="text-green-600" />
        <StatCard label="All unread" value={stats.totalUnread} tone="text-gray-700" />
      </div>

      <AlertFeed showFilters limit={50} />
    </section>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-3xl ${tone}`}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
