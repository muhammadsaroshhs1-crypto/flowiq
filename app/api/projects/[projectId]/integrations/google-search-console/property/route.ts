import { auth } from "@clerk/nextjs/server";
import { IntegrationType } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createAlert } from "@/services/alert-service";

const propertySchema = z.object({
  propertyUrl: z.string().min(1),
});

type SearchConsoleSite = {
  siteUrl: string;
  permissionLevel: string;
};

function configObject(config: unknown) {
  return config && typeof config === "object" && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}

async function authorizeProject(clerkId: string, projectId: string) {
  const workspace = await getCurrentWorkspace(clerkId);
  if (!workspace) return null;

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });

  return project ? { project, workspace } : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "You must be signed in.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body.", code: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = propertySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Choose a valid Search Console property.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const authorization = await authorizeProject(userId, params.projectId);
    if (!authorization) {
      return Response.json({ error: "Project not found.", code: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    const integration = await prisma.projectIntegration.findUnique({
      where: {
        projectId_type: {
          projectId: params.projectId,
          type: IntegrationType.GOOGLE_SEARCH_CONSOLE,
        },
      },
    });

    if (!integration) {
      return Response.json({ error: "Connect Google Search Console first.", code: "GSC_NOT_CONNECTED" }, { status: 404 });
    }

    const config = configObject(integration.config);
    const sites = Array.isArray(config.sites) ? (config.sites as SearchConsoleSite[]) : [];
    const selectedSite = sites.find((site) => site.siteUrl === parsed.data.propertyUrl);

    if (!selectedSite) {
      return Response.json({ error: "Selected property was not returned by Google.", code: "GSC_PROPERTY_NOT_FOUND" }, { status: 400 });
    }

    const updated = await prisma.projectIntegration.update({
      where: { id: integration.id },
      data: {
        config: {
          ...config,
          propertyUrl: selectedSite.siteUrl,
          propertyPermissionLevel: selectedSite.permissionLevel,
        },
        isConnected: true,
        lastSyncedAt: new Date(),
      },
    });

    await createAlert({
      workspaceId: authorization.workspace.id,
      projectId: params.projectId,
      severity: "INFO",
      category: "SEO",
      title: `Google Search Console connected: ${selectedSite.siteUrl}`,
      message: `${selectedSite.siteUrl} is now connected to this FlowIQ project.`,
      actionRequired:
        "No immediate action is required. Next, use this connected property to power topical authority checks, SEO alerts, and reporting.",
      metadata: {
        integration: "GOOGLE_SEARCH_CONSOLE",
        propertyUrl: selectedSite.siteUrl,
        permissionLevel: selectedSite.permissionLevel,
      },
    });

    return Response.json({ integration: updated });
  } catch (error) {
    console.error("Failed to choose Google Search Console property.", error);
    return Response.json({ error: "Could not save Search Console property.", code: "GSC_PROPERTY_SAVE_FAILED" }, { status: 500 });
  }
}
