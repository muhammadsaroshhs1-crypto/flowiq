import { auth } from "@clerk/nextjs/server";
import type { IntegrationType } from "@prisma/client";
import { z } from "zod";

import { encryptCredentials } from "@/lib/encryption";
import { INTEGRATION_TYPES } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const integrationSchema = z.object({
  type: z.enum(INTEGRATION_TYPES as [IntegrationType, ...IntegrationType[]]),
  config: z.record(z.string(), z.unknown()),
});

const publicConfigKeys = new Set(["siteUrl", "webhookSecret", "sellerId", "marketplaceId", "adsProfileId", "propertyUrl", "shopDomain", "siteId"]);

function splitConfig(config: Record<string, unknown>) {
  const publicConfig: Record<string, unknown> = {};
  const sensitiveConfig: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (publicConfigKeys.has(key)) {
      publicConfig[key] = value;
    } else {
      sensitiveConfig[key] = value;
    }
  }

  return { publicConfig, sensitiveConfig };
}

function redactIntegration<T extends { config: unknown }>(integration: T) {
  const config =
    integration.config && typeof integration.config === "object" && !Array.isArray(integration.config)
      ? (integration.config as Record<string, unknown>)
      : {};

  return {
    ...integration,
    config: {
      ...config,
      encryptedCredentials: config.encryptedCredentials ? "[encrypted]" : undefined,
    },
  };
}

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

    const integrations = await prisma.projectIntegration.findMany({
      where: { projectId: params.projectId },
      orderBy: { updatedAt: "desc" },
    });

    return Response.json({ integrations: integrations.map(redactIntegration) });
  } catch (error) {
    console.error("Failed to list project integrations.", error);
    return Response.json({ error: "Could not list integrations.", code: "INTEGRATION_LIST_FAILED" }, { status: 500 });
  }
}

export async function POST(
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

  const parsed = integrationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid integration payload.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const project = await authorizeProject(userId, params.projectId);
    if (!project) {
      return Response.json({ error: "Project not found.", code: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    const { publicConfig, sensitiveConfig } = splitConfig(parsed.data.config);
    const encryptedCredentials =
      Object.keys(sensitiveConfig).length > 0 ? encryptCredentials(sensitiveConfig) : null;

    const integration = await prisma.projectIntegration.upsert({
      where: {
        projectId_type: {
          projectId: params.projectId,
          type: parsed.data.type,
        },
      },
      create: {
        projectId: params.projectId,
        type: parsed.data.type,
        config: {
          ...publicConfig,
          encryptedCredentials,
        },
        isConnected: true,
        lastSyncedAt: new Date(),
      },
      update: {
        config: {
          ...publicConfig,
          encryptedCredentials,
        },
        isConnected: true,
        lastSyncedAt: new Date(),
      },
    });

    return Response.json({ integration: redactIntegration(integration) });
  } catch (error) {
    console.error("Failed to save project integration.", error);
    return Response.json({ error: "Could not save integration.", code: "INTEGRATION_SAVE_FAILED" }, { status: 500 });
  }
}
