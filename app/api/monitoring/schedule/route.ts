import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getMonitoringQueue } from "@/workers/scheduler";

const scheduleSchema = z.object({
  projectId: z.string().min(1),
  checkType: z.enum([
    "UPTIME_CHECK",
    "SSL_CHECK",
    "CWV_CHECK",
    "LINK_CHECK",
    "BACKUP_CHECK",
    "FORM_CHECK",
  ]),
});

function readSiteUrl(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null;
  }

  const siteUrl = (config as { siteUrl?: unknown }).siteUrl;
  return typeof siteUrl === "string" ? siteUrl : null;
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: "You must be signed in.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const parsed = scheduleSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid monitoring schedule request.", code: "VALIDATION_ERROR" },
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

    const project = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, workspaceId: workspace.id },
      include: {
        integrations: {
          where: {
            isConnected: true,
            type: { in: ["WORDPRESS", "SHOPIFY", "WEBFLOW"] },
          },
          take: 1,
        },
      },
    });

    const integration = project?.integrations[0];
    const siteUrl = integration ? readSiteUrl(integration.config) : null;

    if (!project || !integration || !siteUrl) {
      return Response.json(
        { error: "Connect a website integration with a siteUrl first.", code: "WEBSITE_INTEGRATION_MISSING" },
        { status: 400 },
      );
    }

    const queue = getMonitoringQueue();
    const job = await queue.add(parsed.data.checkType, {
      projectId: project.id,
      integrationId: integration.id,
      siteUrl,
      domain: new URL(siteUrl).hostname,
    });

    return Response.json({
      jobId: job.id,
      message: "Check queued, results in 1-2 minutes",
    });
  } catch (error) {
    console.error("Failed to schedule monitoring check.", error);
    return Response.json(
      { error: "Could not queue monitoring check.", code: "MONITORING_QUEUE_FAILED" },
      { status: 500 },
    );
  }
}
