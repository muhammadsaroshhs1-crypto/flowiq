import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const suggestionFiltersSchema = z.object({
  type: z
    .enum([
      "BID_ADJUST",
      "NEGATIVE_KEYWORD",
      "LISTING_OPTIMIZATION",
      "CONTENT_BRIEF",
      "BACKLINK_OPPORTUNITY",
      "WEBSITE_FIX",
    ])
    .optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "APPLIED"]).optional(),
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
    return Response.json(
      { error: "You must be signed in.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const parsed = suggestionFiltersSchema.safeParse({
    type: url.searchParams.get("type") || undefined,
    priority: url.searchParams.get("priority") || undefined,
    status: url.searchParams.get("status") || undefined,
  });

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid suggestion filters.", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    const project = await authorizeProject(userId, params.projectId);

    if (!project) {
      return Response.json(
        { error: "Project not found.", code: "PROJECT_NOT_FOUND" },
        { status: 404 },
      );
    }

    const where = {
      projectId: params.projectId,
      type: parsed.data.type,
      priority: parsed.data.priority,
      status: parsed.data.status,
    };

    const [suggestions, total, pending, highPriority] = await Promise.all([
      prisma.intelligenceSuggestion.findMany({
        where,
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      }),
      prisma.intelligenceSuggestion.count({ where: { projectId: params.projectId } }),
      prisma.intelligenceSuggestion.count({
        where: { projectId: params.projectId, status: "PENDING" },
      }),
      prisma.intelligenceSuggestion.count({
        where: { projectId: params.projectId, priority: "HIGH", status: "PENDING" },
      }),
    ]);

    return Response.json({
      suggestions,
      stats: { total, pending, highPriority },
    });
  } catch (error) {
    console.error("Failed to list Amazon suggestions.", error);
    return Response.json(
      { error: "Could not list suggestions.", code: "AMAZON_SUGGESTIONS_LIST_FAILED" },
      { status: 500 },
    );
  }
}
