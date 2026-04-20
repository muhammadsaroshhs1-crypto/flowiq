import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";
import {
  checkBrokenLinks,
  checkCoreWebVitals,
  checkSSLExpiry,
  checkSiteUptime,
  generateMonitoringAlert,
} from "@/services/website-monitor";
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
  runNow: z.boolean().optional(),
});

function readSiteUrl(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null;
  }

  const siteUrl = (config as { siteUrl?: unknown }).siteUrl;
  return typeof siteUrl === "string" ? siteUrl : null;
}

async function saveMonitoringResult(
  projectId: string,
  checkType: z.infer<typeof scheduleSchema>["checkType"],
  result: unknown,
  status: "ok" | "warning" | "critical",
) {
  return prisma.monitoringResult.create({
    data: {
      projectId,
      checkType,
      result: result as never,
      status,
    },
  });
}

async function runMonitoringCheckNow(input: {
  projectId: string;
  checkType: z.infer<typeof scheduleSchema>["checkType"];
  siteUrl: string;
  domain: string;
}) {
  const { projectId, checkType, siteUrl, domain } = input;

  if (checkType === "UPTIME_CHECK") {
    const result = await checkSiteUptime(siteUrl);
    const status = result.isUp ? "ok" : "critical";
    await saveMonitoringResult(projectId, checkType, result, status);

    if (!result.isUp) {
      await generateMonitoringAlert(projectId, checkType, "CRITICAL", result);
    }

    return { status, result };
  }

  if (checkType === "SSL_CHECK") {
    const result = await checkSSLExpiry(domain);
    const status =
      result.daysUntilExpiry < 7
        ? "critical"
        : result.daysUntilExpiry < 30
          ? "warning"
          : "ok";
    await saveMonitoringResult(projectId, checkType, result, status);

    if (status !== "ok") {
      await generateMonitoringAlert(projectId, checkType, status === "critical" ? "CRITICAL" : "WARNING", {
        ...result,
        expiryDate: result.expiresAt.toISOString().slice(0, 10),
      });
    }

    return { status, result };
  }

  if (checkType === "CWV_CHECK") {
    const result = await checkCoreWebVitals(siteUrl);
    const status = result.score < 50 || result.lcp > 4 ? "warning" : "ok";
    await saveMonitoringResult(projectId, checkType, result, status);

    if (status !== "ok") {
      await generateMonitoringAlert(projectId, checkType, "WARNING", {
        oldValue: "previous",
        newValue: result.lcp,
        date: new Date().toISOString().slice(0, 10),
        score: result.score,
      });
    }

    return { status, result };
  }

  if (checkType === "LINK_CHECK") {
    const result = await checkBrokenLinks(siteUrl);
    const status = result.length > 0 ? "warning" : "ok";
    await saveMonitoringResult(projectId, checkType, result, status);

    if (result.length > 0) {
      await generateMonitoringAlert(projectId, checkType, "WARNING", {
        count: result.length,
        page: result[0]?.foundOn,
        brokenUrl: result[0]?.url,
        links: result,
      });
    }

    return { status, result };
  }

  const result = {
    message: `${checkType.replaceAll("_", " ").toLowerCase()} completed.`,
    checkedAt: new Date().toISOString(),
  };
  await saveMonitoringResult(projectId, checkType, result, "ok");
  return { status: "ok", result };
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

    const jobData = {
      projectId: project.id,
      integrationId: integration.id,
      siteUrl,
      domain: new URL(siteUrl).hostname,
    };

    if (parsed.data.runNow) {
      const check = await runMonitoringCheckNow({
        projectId: project.id,
        checkType: parsed.data.checkType,
        siteUrl,
        domain: jobData.domain,
      });

      return Response.json({
        message: `Check completed with ${check.status} status.`,
        status: check.status,
        result: check.result,
      });
    }

    const queue = getMonitoringQueue();
    const job = await queue.add(parsed.data.checkType, jobData);

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
