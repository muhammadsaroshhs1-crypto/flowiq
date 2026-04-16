import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

export type ProjectSummary = {
  id: string;
  name: string;
  industry: string;
  status: string;
  updatedAt: string;
  openAlerts: number;
  pipelineProgress: number;
};

export type DashboardStatsResponse = {
  activeProjects: number;
  criticalAlerts: number;
  pendingSuggestions: number;
  socialPendingReview: number;
  recentAlerts: unknown[];
  topSuggestions: unknown[];
  projectSummaries: ProjectSummary[];
};

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: "You must be signed in.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    const workspace = await getCurrentWorkspace(userId);

    if (!workspace) {
      return Response.json(
        { error: "Workspace not found.", code: "WORKSPACE_NOT_FOUND" },
        { status: 404 },
      );
    }

    const [
      activeProjects,
      criticalAlerts,
      pendingSuggestions,
      socialPendingReview,
      recentAlerts,
      topSuggestions,
      projects,
    ] = await prisma.$transaction([
      prisma.project.count({ where: { workspaceId: workspace.id, status: "ACTIVE" } }),
      prisma.alert.count({
        where: { workspaceId: workspace.id, severity: "CRITICAL", isResolved: false },
      }),
      prisma.intelligenceSuggestion.count({
        where: { project: { workspaceId: workspace.id }, status: "PENDING" },
      }),
      prisma.socialQueueItem.count({
        where: { project: { workspaceId: workspace.id }, status: "PENDING_REVIEW" },
      }),
      prisma.alert.findMany({
        where: { workspaceId: workspace.id },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.intelligenceSuggestion.findMany({
        where: { project: { workspaceId: workspace.id }, status: "PENDING" },
        include: { project: { select: { id: true, name: true } } },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        take: 6,
      }),
      prisma.project.findMany({
        where: { workspaceId: workspace.id, status: { not: "ARCHIVED" } },
        include: {
          alerts: { where: { isResolved: false }, select: { id: true } },
          pipelines: {
            include: {
              stages: { include: { tasks: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const projectSummaries = projects.map((project) => {
      const tasks = project.pipelines.flatMap((pipeline) =>
        pipeline.stages.flatMap((stage) => stage.tasks),
      );
      const completedTasks = tasks.filter(
        (task) => task.status === "DONE" || task.status === "SKIPPED",
      ).length;

      return {
        id: project.id,
        name: project.name,
        industry: project.industry,
        status: project.status,
        updatedAt: project.updatedAt.toISOString(),
        openAlerts: project.alerts.length,
        pipelineProgress: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
      };
    });

    return Response.json({
      activeProjects,
      criticalAlerts,
      pendingSuggestions,
      socialPendingReview,
      recentAlerts,
      topSuggestions,
      projectSummaries,
    } satisfies DashboardStatsResponse);
  } catch (error) {
    console.error("Failed to load dashboard stats.", error);
    return Response.json(
      { error: "Could not load dashboard stats.", code: "DASHBOARD_STATS_FAILED" },
      { status: 500 },
    );
  }
}
