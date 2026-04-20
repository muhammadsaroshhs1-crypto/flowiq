import { IntegrationType, Prisma, type TaskStatus } from "@prisma/client";

import { decryptCredentials, encryptCredentials } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

type GoogleCredentials = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string | null;
  scope?: string;
  tokenType?: string;
};

type GscRow = {
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type GscResponse = {
  rows?: GscRow[];
};

type GaRunReportResponse = {
  rows?: Array<{
    metricValues?: Array<{ value?: string }>;
  }>;
};

export type ReportWindow = 15 | 30 | 90 | 180;

export type SeoReportSummary = {
  project: {
    id: string;
    name: string;
    clientName: string | null;
  };
  windowDays: ReportWindow;
  ranges: {
    current: { startDate: string; endDate: string };
    previous: { startDate: string; endDate: string };
  };
  seo: {
    current: SeoMetricSet;
    previous: SeoMetricSet;
    deltas: SeoDeltaSet;
  };
  analytics: {
    current: AnalyticsMetricSet;
    previous: AnalyticsMetricSet;
    deltas: AnalyticsDeltaSet;
  };
  work: {
    completedTasks: number;
    totalTasksTouched: number;
    completionRate: number;
    completedTaskList: Array<{ title: string; pipeline: string; stage: string; completedAt: string | null }>;
    statusCounts: Record<TaskStatus, number>;
  };
  operations: {
    alertsCreated: number;
    alertsResolved: number;
    suggestionsCreated: number;
    suggestionsApproved: number;
    monitoringChecks: number;
    criticalWebsiteChecks: number;
  };
  insights: Array<{
    title: string;
    detail: string;
    recommendation: string;
    severity: "good" | "warning" | "critical";
  }>;
  monthlyPlanExists: boolean;
};

type SeoMetricSet = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type AnalyticsMetricSet = {
  users: number;
  sessions: number;
  engagementRate: number;
  bounceRate: number;
};

type SeoDeltaSet = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type AnalyticsDeltaSet = {
  users: number;
  sessions: number;
  engagementRate: number;
  bounceRate: number;
};

function configObject(config: unknown) {
  return config && typeof config === "object" && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}

function getEncryptedCredentials(config: Record<string, unknown>): GoogleCredentials {
  const encrypted = config.encryptedCredentials;
  if (typeof encrypted !== "string") return {};

  try {
    return decryptCredentials(encrypted) as GoogleCredentials;
  } catch {
    return {};
  }
}

async function refreshAccessToken(credentials: GoogleCredentials): Promise<GoogleCredentials> {
  if (!credentials.refreshToken) return credentials;

  const expiresAt = credentials.expiresAt ? new Date(credentials.expiresAt).getTime() : 0;
  if (credentials.accessToken && expiresAt > Date.now() + 60_000) return credentials;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return credentials;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) return credentials;

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };

  return {
    ...credentials,
    accessToken: data.access_token ?? credentials.accessToken,
    expiresAt:
      typeof data.expires_in === "number"
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : credentials.expiresAt,
    scope: data.scope ?? credentials.scope,
    tokenType: data.token_type ?? credentials.tokenType,
  };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function reportRanges(windowDays: ReportWindow) {
  const end = dateDaysAgo(1);
  const currentStart = dateDaysAgo(windowDays);
  const previousEnd = dateDaysAgo(windowDays + 1);
  const previousStart = dateDaysAgo(windowDays * 2);

  return {
    current: { startDate: isoDate(currentStart), endDate: isoDate(end) },
    previous: { startDate: isoDate(previousStart), endDate: isoDate(previousEnd) },
  };
}

function numberValue(value: string | undefined) {
  return Number(value ?? 0);
}

function sumGscRows(rows: GscRow[]): SeoMetricSet {
  const clicks = rows.reduce((sum, row) => sum + (row.clicks ?? 0), 0);
  const impressions = rows.reduce((sum, row) => sum + (row.impressions ?? 0), 0);
  const position =
    impressions > 0
      ? rows.reduce((sum, row) => sum + (row.position ?? 0) * (row.impressions ?? 0), 0) / impressions
      : 0;

  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position,
  };
}

function delta(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

async function postGoogle<T>(url: string, accessToken: string, body: object): Promise<T | null> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) return null;
  return (await response.json()) as T;
}

async function fetchGscMetrics(propertyUrl: string, accessToken: string, range: { startDate: string; endDate: string }) {
  if (!propertyUrl || !accessToken) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };

  const sitePath = encodeURIComponent(propertyUrl);
  const data = await postGoogle<GscResponse>(
    `https://www.googleapis.com/webmasters/v3/sites/${sitePath}/searchAnalytics/query`,
    accessToken,
    {
      startDate: range.startDate,
      endDate: range.endDate,
      dimensions: ["page"],
      rowLimit: 250,
    },
  );

  return sumGscRows(data?.rows ?? []);
}

async function fetchGaMetrics(ga4PropertyId: string, accessToken: string, range: { startDate: string; endDate: string }) {
  if (!ga4PropertyId || !accessToken) {
    return { users: 0, sessions: 0, engagementRate: 0, bounceRate: 0 };
  }

  const data = await postGoogle<GaRunReportResponse>(
    `https://analyticsdata.googleapis.com/v1beta/properties/${ga4PropertyId}:runReport`,
    accessToken,
    {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "engagementRate" },
        { name: "bounceRate" },
      ],
    },
  );

  const row = data?.rows?.[0];
  return {
    users: numberValue(row?.metricValues?.[0]?.value),
    sessions: numberValue(row?.metricValues?.[1]?.value),
    engagementRate: numberValue(row?.metricValues?.[2]?.value),
    bounceRate: numberValue(row?.metricValues?.[3]?.value),
  };
}

function buildInsights(input: {
  seo: SeoReportSummary["seo"];
  analytics: SeoReportSummary["analytics"];
  work: SeoReportSummary["work"];
  operations: SeoReportSummary["operations"];
}) {
  const insights: SeoReportSummary["insights"] = [];

  if (input.seo.deltas.clicks > 5) {
    insights.push({
      severity: "good",
      title: "Organic clicks improved",
      detail: `Organic clicks increased by ${Math.round(input.seo.deltas.clicks)}% compared with the previous period.`,
      recommendation: "Keep updating the pages that contributed to the lift and add internal links to them from relevant pages.",
    });
  } else if (input.seo.deltas.clicks < -10) {
    insights.push({
      severity: "critical",
      title: "Organic clicks dropped",
      detail: `Organic clicks dropped by ${Math.abs(Math.round(input.seo.deltas.clicks))}% compared with the previous period.`,
      recommendation: "Review top pages in Search Console, check indexing, compare ranking queries, and prioritize pages that lost impressions or CTR.",
    });
  }

  if (input.analytics.current.users > 0 && input.analytics.current.engagementRate < 0.45) {
    insights.push({
      severity: "warning",
      title: "Traffic quality needs attention",
      detail: "GA4 shows users, but engagement rate is below the target threshold.",
      recommendation: "Improve above-the-fold clarity, match page content to search intent, add proof, and place a single clear CTA.",
    });
  }

  if (input.work.completionRate < 60) {
    insights.push({
      severity: "warning",
      title: "SEO delivery pace is behind",
      detail: `Only ${input.work.completionRate}% of touched tasks are completed for this reporting period.`,
      recommendation: "Move overdue work into this week's priority list and assign owners to any unowned tasks.",
    });
  }

  if (input.operations.criticalWebsiteChecks > 0) {
    insights.push({
      severity: "critical",
      title: "Critical website checks detected",
      detail: `${input.operations.criticalWebsiteChecks} critical monitoring checks were found in this period.`,
      recommendation: "Open Monitoring, resolve critical issues first, then rerun checks before sending the client report.",
    });
  }

  if (!insights.length) {
    insights.push({
      severity: "good",
      title: "Project is stable",
      detail: "FlowIQ did not detect a major negative movement in the selected reporting window.",
      recommendation: "Continue the recurring SEO plan and use Authority Opportunities to choose the next growth actions.",
    });
  }

  return insights;
}

export async function getSeoReport(projectId: string, windowDays: ReportWindow): Promise<SeoReportSummary> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, clientName: true },
  });

  if (!project) throw new Error("Project not found.");

  const ranges = reportRanges(windowDays);
  const currentStart = new Date(`${ranges.current.startDate}T00:00:00.000Z`);
  const currentEnd = new Date(`${ranges.current.endDate}T23:59:59.999Z`);

  const gscIntegration = await prisma.projectIntegration.findUnique({
    where: { projectId_type: { projectId, type: IntegrationType.GOOGLE_SEARCH_CONSOLE } },
  });
  const config = configObject(gscIntegration?.config);
  const propertyUrl = typeof config.propertyUrl === "string" ? config.propertyUrl : "";
  const ga4PropertyId = typeof config.ga4PropertyId === "string" ? config.ga4PropertyId : "";
  const oldCredentials = getEncryptedCredentials(config);
  const credentials = await refreshAccessToken(oldCredentials);
  const accessToken = credentials.accessToken ?? "";

  if (gscIntegration && accessToken && accessToken !== oldCredentials.accessToken) {
    await prisma.projectIntegration.update({
      where: { id: gscIntegration.id },
      data: { config: { ...config, encryptedCredentials: encryptCredentials(credentials) } },
    });
  }

  const [seoCurrent, seoPrevious, gaCurrent, gaPrevious, tasks, alerts, suggestions, monitoringResults, monthlyPlan] =
    await Promise.all([
      fetchGscMetrics(propertyUrl, accessToken, ranges.current),
      fetchGscMetrics(propertyUrl, accessToken, ranges.previous),
      fetchGaMetrics(ga4PropertyId, accessToken, ranges.current),
      fetchGaMetrics(ga4PropertyId, accessToken, ranges.previous),
      prisma.task.findMany({
        where: {
          stage: { pipeline: { projectId } },
          OR: [
            { completedAt: { gte: currentStart, lte: currentEnd } },
            { stage: { pipeline: { updatedAt: { gte: currentStart, lte: currentEnd } } } },
          ],
        },
        include: { stage: { include: { pipeline: { select: { name: true } } } } },
        orderBy: [{ completedAt: "desc" }, { order: "asc" }],
      }),
      prisma.alert.findMany({
        where: { projectId, createdAt: { gte: currentStart, lte: currentEnd } },
        select: { isResolved: true },
      }),
      prisma.intelligenceSuggestion.findMany({
        where: { projectId, createdAt: { gte: currentStart, lte: currentEnd } },
        select: { status: true },
      }),
      prisma.monitoringResult.findMany({
        where: { projectId, createdAt: { gte: currentStart, lte: currentEnd } },
        select: { status: true },
      }),
      prisma.pipeline.findFirst({
        where: { projectId, moduleType: "SEO_MONTHLY_PLAN", isRecurring: true, status: { not: "COMPLETED" } },
        select: { id: true },
      }),
    ]);

  const statusCounts = tasks.reduce<Record<TaskStatus, number>>(
    (counts, task) => ({ ...counts, [task.status]: counts[task.status] + 1 }),
    { PENDING: 0, IN_PROGRESS: 0, DONE: 0, SKIPPED: 0 },
  );
  const completedTasks = tasks.filter((task) => task.status === "DONE").length;
  const completionRate = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const work = {
    completedTasks,
    totalTasksTouched: tasks.length,
    completionRate,
    statusCounts,
    completedTaskList: tasks
      .filter((task) => task.status === "DONE")
      .slice(0, 20)
      .map((task) => ({
        title: task.title,
        pipeline: task.stage.pipeline.name,
        stage: task.stage.name,
        completedAt: task.completedAt?.toISOString() ?? null,
      })),
  };

  const operations = {
    alertsCreated: alerts.length,
    alertsResolved: alerts.filter((alert) => alert.isResolved).length,
    suggestionsCreated: suggestions.length,
    suggestionsApproved: suggestions.filter((suggestion) => suggestion.status === "APPROVED").length,
    monitoringChecks: monitoringResults.length,
    criticalWebsiteChecks: monitoringResults.filter((result) => result.status === "critical").length,
  };

  const seo = {
    current: seoCurrent,
    previous: seoPrevious,
    deltas: {
      clicks: delta(seoCurrent.clicks, seoPrevious.clicks),
      impressions: delta(seoCurrent.impressions, seoPrevious.impressions),
      ctr: delta(seoCurrent.ctr, seoPrevious.ctr),
      position: seoPrevious.position ? ((seoPrevious.position - seoCurrent.position) / seoPrevious.position) * 100 : 0,
    },
  };
  const analytics = {
    current: gaCurrent,
    previous: gaPrevious,
    deltas: {
      users: delta(gaCurrent.users, gaPrevious.users),
      sessions: delta(gaCurrent.sessions, gaPrevious.sessions),
      engagementRate: delta(gaCurrent.engagementRate, gaPrevious.engagementRate),
      bounceRate: delta(gaCurrent.bounceRate, gaPrevious.bounceRate),
    },
  };

  return {
    project,
    windowDays,
    ranges,
    seo,
    analytics,
    work,
    operations,
    insights: buildInsights({ seo, analytics, work, operations }),
    monthlyPlanExists: Boolean(monthlyPlan),
  };
}

export async function createMonthlySeoPlan(projectId: string) {
  const existing = await prisma.pipeline.findFirst({
    where: { projectId, moduleType: "SEO_MONTHLY_PLAN", isRecurring: true, status: { not: "COMPLETED" } },
    select: { id: true },
  });

  if (existing) return existing;

  const stages = [
    {
      name: "Week 1 - Audit and measurement",
      tasks: [
        "Review GSC clicks, impressions, CTR, and ranking movement",
        "Review GA4 users, sessions, engagement, and conversions",
        "Run website uptime, SSL, PageSpeed, and broken link checks",
        "Review Google Business Profile performance when connected",
      ],
    },
    {
      name: "Week 2 - Content and on-page improvements",
      tasks: [
        "Refresh one existing page with weak CTR or engagement",
        "Create one new blog or resource brief from topical gaps",
        "Add internal links to one priority page",
        "Prepare one Google Business Profile post idea",
      ],
    },
    {
      name: "Week 3 - Authority and local growth",
      tasks: [
        "Review Authority Opportunities and choose outreach targets",
        "Update one business profile, citation, or partner listing",
        "Find one unlinked mention or relevant resource-page prospect",
        "Document any reviews, GBP updates, or local SEO actions",
      ],
    },
    {
      name: "Week 4 - Reporting and next-month plan",
      tasks: [
        "Prepare 30-day SEO report",
        "Summarize completed tasks and unresolved blockers",
        "Choose next month priority pages and topics",
        "Send report and next-step plan to the client/team",
      ],
    },
  ];

  return prisma.pipeline.create({
    data: {
      projectId,
      name: "Monthly SEO Operating Plan",
      description: "Recurring monthly SEO delivery plan covering measurement, content, authority, GBP, technical checks, and reporting.",
      industry: "SEO",
      moduleType: "SEO_MONTHLY_PLAN",
      isRecurring: true,
      recurringCadence: "monthly",
      status: "ACTIVE",
      stages: {
        create: stages.map((stage, stageIndex) => ({
          name: stage.name,
          order: stageIndex + 1,
          status: "NOT_STARTED",
          tasks: {
            create: stage.tasks.map((task, taskIndex) => ({
              title: task,
              order: taskIndex + 1,
              status: "PENDING",
              isRequired: true,
            })),
          },
        })),
      },
    },
    select: { id: true },
  });
}
