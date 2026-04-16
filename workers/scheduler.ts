import { Queue } from "bullmq";
import IORedis from "ioredis";

import { prisma } from "@/lib/prisma";
import type { MonitoringJobData, MonitoringJobType } from "@/workers/monitoring-worker";

let queue: Queue<MonitoringJobData, unknown, MonitoringJobType> | null = null;

function createQueue() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required to schedule monitoring jobs.");
  }

  const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  return new Queue<MonitoringJobData, unknown, MonitoringJobType>("monitoring", {
    connection,
  });
}

function getDomain(siteUrl: string) {
  return new URL(siteUrl).hostname;
}

function readSiteUrl(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null;
  }

  const siteUrl = (config as { siteUrl?: unknown }).siteUrl;
  return typeof siteUrl === "string" ? siteUrl : null;
}

async function scheduleProjectChecks(
  monitoringQueue: Queue<MonitoringJobData, unknown, MonitoringJobType>,
) {
  const integrations = await prisma.projectIntegration.findMany({
    where: {
      isConnected: true,
      type: { in: ["WORDPRESS", "SHOPIFY", "WEBFLOW"] },
      project: {
        modules: { has: "Website monitoring & alerts" },
        status: "ACTIVE",
      },
    },
    include: {
      project: {
        select: { id: true },
      },
    },
  });

  for (const integration of integrations) {
    const siteUrl = readSiteUrl(integration.config);
    if (!siteUrl) continue;

    const data = {
      projectId: integration.project.id,
      integrationId: integration.id,
      siteUrl,
      domain: getDomain(siteUrl),
    };

    await monitoringQueue.add("UPTIME_CHECK", data, {
      repeat: { pattern: "*/5 * * * *" },
      jobId: `uptime:${integration.id}`,
    });
    await monitoringQueue.add("SSL_CHECK", data, {
      repeat: { pattern: "0 2 * * *" },
      jobId: `ssl:${integration.id}`,
    });
    await monitoringQueue.add("CWV_CHECK", data, {
      repeat: { pattern: "0 4 * * 1" },
      jobId: `cwv:${integration.id}`,
    });
    await monitoringQueue.add("LINK_CHECK", data, {
      repeat: { pattern: "0 5 * * 1" },
      jobId: `links:${integration.id}`,
    });
    await monitoringQueue.add("FORM_CHECK", data, {
      repeat: { pattern: "0 3 * * *" },
      jobId: `forms:${integration.id}`,
    });
  }
}

export async function startScheduler() {
  if (!queue) {
    queue = createQueue();
  }

  await scheduleProjectChecks(queue);
  return queue;
}

export async function stopScheduler() {
  if (queue) {
    await queue.close();
    queue = null;
  }
}

export function getMonitoringQueue() {
  if (!queue) {
    queue = createQueue();
  }

  return queue;
}
