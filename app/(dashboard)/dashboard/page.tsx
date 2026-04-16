import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { AlertFeed } from "@/components/alerts/alert-feed";
import { CriticalBanner } from "@/components/dashboard/critical-banner";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { SuggestionsQueue } from "@/components/dashboard/suggestions-queue";
import { ProjectCard } from "@/components/projects/project-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectsByWorkspace } from "@/lib/projects";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const workspace = await getCurrentWorkspace(userId);

  if (!workspace) {
    redirect("/onboarding");
  }

  const [
    projects,
    criticalAlerts,
    criticalAlertCount,
    pendingSuggestions,
    socialPendingReview,
    topSuggestions,
  ] = await Promise.all([
    getProjectsByWorkspace(workspace.id),
    prisma.alert.findMany({
      where: { workspaceId: workspace.id, severity: "CRITICAL", isResolved: false },
      orderBy: { createdAt: "desc" },
      take: 2,
    }),
    prisma.alert.count({
      where: { workspaceId: workspace.id, severity: "CRITICAL", isResolved: false },
    }),
    prisma.intelligenceSuggestion.count({
      where: { project: { workspaceId: workspace.id }, status: "PENDING" },
    }),
    prisma.socialQueueItem.count({
      where: { project: { workspaceId: workspace.id }, status: "PENDING_REVIEW" },
    }),
    prisma.intelligenceSuggestion.findMany({
      where: { project: { workspaceId: workspace.id }, status: "PENDING" },
      include: { project: { select: { id: true, name: true } } },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 6,
    }),
  ]);

  const activeProjects = projects.filter((project) => project.status === "ACTIVE").length;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{workspace.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      <StatsBar
        stats={{
          activeProjects,
          criticalAlerts: criticalAlertCount,
          pendingSuggestions,
          socialPendingReview,
        }}
      />

      <CriticalBanner criticalCount={criticalAlertCount} alerts={criticalAlerts} />

      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        <Link href="/projects">
          <Card className="flex h-full min-h-52 items-center justify-center rounded-lg border-dashed transition hover:bg-muted">
            <CardHeader className="items-center text-center">
              <div className="rounded-lg border bg-background p-3">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle>New project</CardTitle>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Recent alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertFeed limit={8} showFilters={false} />
            <Link href="/alerts" className="mt-4 inline-block text-sm font-medium underline underline-offset-4">
              View all alerts
            </Link>
          </CardContent>
        </Card>

        <SuggestionsQueue suggestions={topSuggestions} />
      </div>
    </section>
  );
}
