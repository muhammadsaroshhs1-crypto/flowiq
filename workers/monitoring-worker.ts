import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";

import { prisma } from "@/lib/prisma";
import {
  checkBrokenLinks,
  checkCoreWebVitals,
  checkSSLExpiry,
  checkSiteUptime,
  generateMonitoringAlert,
} from "@/services/website-monitor";

export type MonitoringJobType =
  | "UPTIME_CHECK"
  | "SSL_CHECK"
  | "CWV_CHECK"
  | "LINK_CHECK"
  | "BACKUP_CHECK"
  | "FORM_CHECK";

export type MonitoringJobData = {
  projectId: string;
  integrationId: string;
  siteUrl: string;
  domain: string;
};

function createRedisConnection() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required to start the monitoring worker.");
  }

  return new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

async function saveResult(
  projectId: string,
  checkType: MonitoringJobType,
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

async function processMonitoringJob(job: Job<MonitoringJobData, unknown, MonitoringJobType>) {
  const { projectId, siteUrl, domain } = job.data;

  try {
    if (job.name === "UPTIME_CHECK") {
      const result = await checkSiteUptime(siteUrl);
      const status = result.isUp ? "ok" : "critical";
      await saveResult(projectId, job.name, result, status);

      if (!result.isUp) {
        await generateMonitoringAlert(projectId, job.name, "CRITICAL", result);
      }
    }

    if (job.name === "SSL_CHECK") {
      const result = await checkSSLExpiry(domain);
      const status =
        result.daysUntilExpiry < 7
          ? "critical"
          : result.daysUntilExpiry < 30
            ? "warning"
            : "ok";
      await saveResult(projectId, job.name, result, status);

      if (status !== "ok") {
        await generateMonitoringAlert(projectId, job.name, status === "critical" ? "CRITICAL" : "WARNING", {
          ...result,
          expiryDate: result.expiresAt.toISOString().slice(0, 10),
        });
      }
    }

    if (job.name === "CWV_CHECK") {
      const result = await checkCoreWebVitals(siteUrl);
      const previous = await prisma.monitoringResult.findFirst({
        where: { projectId, checkType: "CWV_CHECK" },
        orderBy: { createdAt: "desc" },
      });
      const previousResult = previous?.result as { lcp?: number } | undefined;
      const lcpRegression =
        typeof previousResult?.lcp === "number" && result.lcp - previousResult.lcp > 1;
      const status = result.score < 50 || lcpRegression ? "warning" : "ok";

      await saveResult(projectId, job.name, result, status);

      if (lcpRegression) {
        await generateMonitoringAlert(projectId, job.name, "WARNING", {
          oldValue: previousResult?.lcp,
          newValue: result.lcp,
          date: previous?.createdAt.toISOString().slice(0, 10),
        });
      }
    }

    if (job.name === "LINK_CHECK") {
      const result = await checkBrokenLinks(siteUrl);
      const status = result.length > 0 ? "warning" : "ok";
      await saveResult(projectId, job.name, result, status);

      if (result.length > 0) {
        await generateMonitoringAlert(projectId, job.name, "WARNING", {
          count: result.length,
          page: result[0]?.foundOn,
          brokenUrl: result[0]?.url,
          links: result,
        });
      }
    }

    if (job.name === "BACKUP_CHECK" || job.name === "FORM_CHECK") {
      const result = {
        message: `${job.name} placeholder completed for MVP.`,
        checkedAt: new Date().toISOString(),
      };
      await saveResult(projectId, job.name, result, "ok");
    }
  } catch (error) {
    await saveResult(
      projectId,
      job.name,
      { error: error instanceof Error ? error.message : "Unknown monitoring error" },
      "critical",
    );
    throw error;
  }
}

export function startMonitoringWorker() {
  const worker = new Worker<MonitoringJobData, unknown, MonitoringJobType>(
    "monitoring",
    processMonitoringJob,
    {
      connection: createRedisConnection(),
      concurrency: 5,
    },
  );

  worker.on("failed", (job, error) => {
    console.error(`Monitoring job ${job?.id ?? "unknown"} failed.`, error);
  });

  return worker;
}
