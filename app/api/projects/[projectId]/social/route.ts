import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const querySchema = z.object({
  status: z.enum(["PENDING_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "REJECTED"]).optional(),
  platform: z.enum(["LINKEDIN", "INSTAGRAM", "FACEBOOK", "TWITTER"]).optional(),
});

async function authorizeProject(clerkId: string, projectId: string) {
  const workspace = await getCurrentWorkspace(clerkId);
  if (!workspace) return null;

  return prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });
}

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "You must be signed in.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    status: url.searchParams.get("status") || undefined,
    platform: url.searchParams.get("platform") || undefined,
  });

  if (!parsed.success) {
    return Response.json({ error: "Invalid filters.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const project = await authorizeProject(userId, params.projectId);
    if (!project) {
      return Response.json({ error: "Project not found.", code: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    const where = {
      projectId: params.projectId,
      status: parsed.data.status,
      platform: parsed.data.platform,
    };

    const [items, groupedStats] = await Promise.all([
      prisma.socialQueueItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
      }),
      prisma.socialQueueItem.groupBy({
        by: ["status"],
        where: { projectId: params.projectId },
        _count: { status: true },
      }),
    ]);

    const stats = {
      PENDING_REVIEW: 0,
      APPROVED: 0,
      SCHEDULED: 0,
      PUBLISHED: 0,
      REJECTED: 0,
    };

    for (const stat of groupedStats) {
      stats[stat.status] = stat._count.status;
    }

    return Response.json({ items, stats });
  } catch (error) {
    console.error("Failed to list social queue.", error);
    return Response.json({ error: "Could not list social queue.", code: "SOCIAL_QUEUE_LIST_FAILED" }, { status: 500 });
  }
}
