import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getSearchIntelligenceDashboard } from "@/services/search-intelligence";

async function authorizeProject(clerkId: string, projectId: string) {
  const workspace = await getCurrentWorkspace(clerkId);
  if (!workspace) return null;

  return prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });
}

export async function GET(
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

    const dashboard = await getSearchIntelligenceDashboard(params.projectId);
    return Response.json({ dashboard });
  } catch (error) {
    console.error("Failed to load search intelligence dashboard.", error);
    return Response.json(
      { error: "Could not load SEO and Analytics intelligence.", code: "SEARCH_INTELLIGENCE_LOAD_FAILED" },
      { status: 500 },
    );
  }
}

