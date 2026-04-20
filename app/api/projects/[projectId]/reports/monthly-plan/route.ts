import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createMonthlySeoPlan } from "@/services/seo-reporting";

async function authorizeProject(clerkId: string, projectId: string) {
  const workspace = await getCurrentWorkspace(clerkId);
  if (!workspace) return null;

  return prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });
}

export async function POST(
  _request: Request,
  { params }: { params: { projectId: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "You must be signed in.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const project = await authorizeProject(userId, params.projectId);
    if (!project) {
      return Response.json({ error: "Project not found.", code: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    const pipeline = await createMonthlySeoPlan(params.projectId);
    return Response.json({ pipelineId: pipeline.id });
  } catch (error) {
    console.error("Failed to create monthly SEO plan.", error);
    return Response.json({ error: "Could not create monthly SEO plan.", code: "MONTHLY_PLAN_FAILED" }, { status: 500 });
  }
}
