import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getAlertStats } from "@/services/alert-service";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const alertsQuerySchema = z.object({
  severity: z.enum(["CRITICAL", "WARNING", "INFO", "all"]).default("all"),
  category: z.enum(["SEO", "AMAZON", "WEBSITE", "SOCIAL", "BILLING", "SYSTEM", "all"]).default("all"),
  projectId: z.string().default("all"),
  isRead: z.enum(["true", "false", "all"]).default("all"),
  isResolved: z.enum(["true", "false", "all"]).default("all"),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: "You must be signed in.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const parsed = alertsQuerySchema.safeParse({
    severity: url.searchParams.get("severity") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    projectId: url.searchParams.get("projectId") ?? undefined,
    isRead: url.searchParams.get("isRead") ?? undefined,
    isResolved: url.searchParams.get("isResolved") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid alert filters.", code: "VALIDATION_ERROR" },
      { status: 400 },
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

    const where = {
      workspaceId: workspace.id,
      severity: parsed.data.severity === "all" ? undefined : parsed.data.severity,
      category: parsed.data.category === "all" ? undefined : parsed.data.category,
      projectId: parsed.data.projectId === "all" ? undefined : parsed.data.projectId,
      isRead: parsed.data.isRead === "all" ? undefined : parsed.data.isRead === "true",
      isResolved:
        parsed.data.isResolved === "all" ? undefined : parsed.data.isResolved === "true",
    };

    const [alerts, total, stats] = await Promise.all([
      prisma.alert.findMany({
        where,
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: parsed.data.limit,
        skip: parsed.data.offset,
      }),
      prisma.alert.count({ where }),
      getAlertStats(workspace.id),
    ]);

    return Response.json({ alerts, total, stats });
  } catch (error) {
    console.error("Failed to list alerts.", error);
    return Response.json(
      { error: "Could not list alerts.", code: "ALERT_LIST_FAILED" },
      { status: 500 },
    );
  }
}
