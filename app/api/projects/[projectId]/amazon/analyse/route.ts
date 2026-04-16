import { auth } from "@clerk/nextjs/server";

import {
  analyseAdPerformance,
  analyseListingHealth,
} from "@/services/amazon-intelligence";
import { getMockAmazonListings } from "@/lib/mock-amazon-data";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

async function authorizeProject(clerkId: string, projectId: string) {
  const workspace = await getCurrentWorkspace(clerkId);
  if (!workspace) return null;

  return prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    include: { integrations: true },
  });
}

export async function POST(
  _request: Request,
  { params }: { params: { projectId: string } },
) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: "You must be signed in.", code: "UNAUTHORIZED" },
      { status: 401 },
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

    const amazonIntegration = project.integrations.find(
      (integration) => integration.type === "AMAZON" && integration.isConnected,
    );

    if (!amazonIntegration) {
      return Response.json(
        { error: "Connect Amazon Seller Central first", code: "AMAZON_NOT_CONNECTED" },
        { status: 400 },
      );
    }

    const [adSuggestions, listingSuggestions] = await Promise.all([
      analyseAdPerformance(params.projectId),
      analyseListingHealth(params.projectId, getMockAmazonListings()),
    ]);

    const suggestions = [...adSuggestions, ...listingSuggestions];

    return Response.json({
      suggestionsCreated: suggestions.length,
      suggestions,
    });
  } catch (error) {
    console.error("Failed to run Amazon analysis.", error);
    return Response.json(
      { error: "Could not run Amazon analysis.", code: "AMAZON_ANALYSIS_FAILED" },
      { status: 500 },
    );
  }
}
