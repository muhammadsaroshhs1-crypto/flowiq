import { IntegrationType } from "@prisma/client";

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
  keys?: string[];
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
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

export type MetricCard = {
  label: string;
  value: string;
  status: "good" | "warning" | "critical";
  helper: string;
};

export type TableRow = Record<string, string | number>;

export type IntelligenceInsight = {
  severity: "good" | "warning" | "critical";
  title: string;
  problem: string;
  impact: string;
  fix: string;
};

export type SearchIntelligenceDashboard = {
  connected: {
    gsc: boolean;
    ga4: boolean;
    gscPropertyUrl?: string;
    ga4PropertyId?: string;
    ga4PropertyName?: string;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
  seo: {
    metrics: MetricCard[];
    topQueries: TableRow[];
    topPages: TableRow[];
    trend: Array<{ date: string; clicks: number; impressions: number }>;
  };
  analytics: {
    metrics: MetricCard[];
    trafficSources: TableRow[];
    landingPages: TableRow[];
    trend: Array<{ date: string; users: number; sessions: number }>;
  };
  technicalAudit: IntelligenceInsight[];
  opportunities: IntelligenceInsight[];
  backlinks: IntelligenceInsight[];
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
  if (credentials.accessToken && expiresAt > Date.now() + 60_000) {
    return credentials;
  }

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

  if (!response.ok) {
    console.warn("Google token refresh failed.", response.status, await response.text());
    return credentials;
  }

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

function isoDate(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function numberFormat(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function percentFormat(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
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

  if (!response.ok) {
    console.warn("Google API request failed.", url, response.status, await response.text());
    return null;
  }

  return (await response.json()) as T;
}

function sumRows(rows: GscRow[]) {
  const clicks = rows.reduce((sum, row) => sum + (row.clicks ?? 0), 0);
  const impressions = rows.reduce((sum, row) => sum + (row.impressions ?? 0), 0);
  const weightedPosition =
    impressions > 0
      ? rows.reduce((sum, row) => sum + (row.position ?? 0) * (row.impressions ?? 0), 0) / impressions
      : 0;

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: weightedPosition,
  };
}

function gaMetric(row: NonNullable<GaRunReportResponse["rows"]>[number], index: number) {
  return Number(row.metricValues?.[index]?.value ?? 0);
}

function gaDimension(row: NonNullable<GaRunReportResponse["rows"]>[number], index: number) {
  return row.dimensionValues?.[index]?.value ?? "";
}

export async function getSearchIntelligenceDashboard(projectId: string): Promise<SearchIntelligenceDashboard> {
  const startDate = isoDate(28);
  const endDate = isoDate(1);
  const gscIntegration = await prisma.projectIntegration.findUnique({
    where: {
      projectId_type: {
        projectId,
        type: IntegrationType.GOOGLE_SEARCH_CONSOLE,
      },
    },
  });

  const config = configObject(gscIntegration?.config);
  const propertyUrl = typeof config.propertyUrl === "string" ? config.propertyUrl : "";
  const ga4PropertyId = typeof config.ga4PropertyId === "string" ? config.ga4PropertyId : "";
  const ga4PropertyName = typeof config.ga4PropertyName === "string" ? config.ga4PropertyName : "";
  const credentials = await refreshAccessToken(getEncryptedCredentials(config));
  const accessToken = credentials.accessToken ?? "";

  if (gscIntegration && credentials.accessToken && credentials.accessToken !== getEncryptedCredentials(config).accessToken) {
    await prisma.projectIntegration.update({
      where: { id: gscIntegration.id },
      data: {
        config: {
          ...config,
          encryptedCredentials: encryptCredentials(credentials),
        },
      },
    });
  }

  let queryRows: GscRow[] = [];
  let pageRows: GscRow[] = [];
  let dateRows: GscRow[] = [];
  let gaTrafficRows: NonNullable<GaRunReportResponse["rows"]> = [];
  let gaLandingRows: NonNullable<GaRunReportResponse["rows"]> = [];
  let gaTrendRows: NonNullable<GaRunReportResponse["rows"]> = [];

  if (propertyUrl && accessToken) {
    const sitePath = encodeURIComponent(propertyUrl);
    const baseUrl = `https://www.googleapis.com/webmasters/v3/sites/${sitePath}/searchAnalytics/query`;
    const [queries, pages, dates] = await Promise.all([
      postGoogle<GscResponse>(baseUrl, accessToken, {
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: 10,
      }),
      postGoogle<GscResponse>(baseUrl, accessToken, {
        startDate,
        endDate,
        dimensions: ["page"],
        rowLimit: 10,
      }),
      postGoogle<GscResponse>(baseUrl, accessToken, {
        startDate,
        endDate,
        dimensions: ["date"],
        rowLimit: 28,
      }),
    ]);

    queryRows = queries?.rows ?? [];
    pageRows = pages?.rows ?? [];
    dateRows = dates?.rows ?? [];
  }

  if (ga4PropertyId && accessToken) {
    const baseUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${ga4PropertyId}:runReport`;
    const [traffic, landing, trend] = await Promise.all([
      postGoogle<GaRunReportResponse>(baseUrl, accessToken, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "engagementRate" }, { name: "bounceRate" }],
        limit: 8,
      }),
      postGoogle<GaRunReportResponse>(baseUrl, accessToken, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "engagementRate" }, { name: "conversions" }],
        limit: 10,
      }),
      postGoogle<GaRunReportResponse>(baseUrl, accessToken, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        limit: 28,
      }),
    ]);

    gaTrafficRows = traffic?.rows ?? [];
    gaLandingRows = landing?.rows ?? [];
    gaTrendRows = trend?.rows ?? [];
  }

  const seoTotals = sumRows(queryRows.length ? queryRows : pageRows);
  const totalUsers = gaTrafficRows.reduce((sum, row) => sum + gaMetric(row, 0), 0);
  const totalSessions = gaTrafficRows.reduce((sum, row) => sum + gaMetric(row, 1), 0);
  const avgEngagement = gaTrafficRows.length
    ? gaTrafficRows.reduce((sum, row) => sum + gaMetric(row, 2), 0) / gaTrafficRows.length
    : 0;
  const avgBounce = gaTrafficRows.length
    ? gaTrafficRows.reduce((sum, row) => sum + gaMetric(row, 3), 0) / gaTrafficRows.length
    : 0;

  const topQueries = queryRows.map((row) => ({
    query: row.keys?.[0] ?? "(not set)",
    clicks: numberFormat(row.clicks ?? 0),
    impressions: numberFormat(row.impressions ?? 0),
    ctr: percentFormat(row.ctr ?? 0),
    position: Math.round((row.position ?? 0) * 10) / 10,
  }));

  const topPages = pageRows.map((row) => ({
    page: row.keys?.[0] ?? "(not set)",
    clicks: numberFormat(row.clicks ?? 0),
    impressions: numberFormat(row.impressions ?? 0),
    ctr: percentFormat(row.ctr ?? 0),
    position: Math.round((row.position ?? 0) * 10) / 10,
  }));

  const trafficSources = gaTrafficRows.map((row) => ({
    source: gaDimension(row, 0) || "(not set)",
    users: numberFormat(gaMetric(row, 0)),
    sessions: numberFormat(gaMetric(row, 1)),
    engagement: percentFormat(gaMetric(row, 2)),
    bounce: percentFormat(gaMetric(row, 3)),
  }));

  const landingPages = gaLandingRows.map((row) => ({
    page: gaDimension(row, 0) || "(not set)",
    users: numberFormat(gaMetric(row, 0)),
    sessions: numberFormat(gaMetric(row, 1)),
    engagement: percentFormat(gaMetric(row, 2)),
    conversions: Math.round(gaMetric(row, 3) * 10) / 10,
  }));

  const opportunities: IntelligenceInsight[] = [];
  const lowCtrQuery = queryRows.find((row) => (row.impressions ?? 0) > 100 && (row.ctr ?? 0) < 0.02);
  if (lowCtrQuery) {
    opportunities.push({
      severity: "warning",
      title: "High impressions but low clicks",
      problem: `"${lowCtrQuery.keys?.[0] ?? "A query"}" is getting search visibility but not enough clicks.`,
      impact: "You may be losing traffic because the title/meta description is not compelling enough.",
      fix: "Rewrite the page title with a clearer benefit, add the primary keyword near the front, and improve the meta description CTA.",
    });
  }

  const weakLanding = gaLandingRows.find((row) => gaMetric(row, 0) > 20 && gaMetric(row, 2) < 0.45);
  if (weakLanding) {
    opportunities.push({
      severity: "critical",
      title: "Traffic arrives but engagement is weak",
      problem: `${gaDimension(weakLanding, 0)} receives users but has low engagement.`,
      impact: "The search intent and on-page content may not match, so visitors leave before converting.",
      fix: "Improve the first screen, answer the query faster, add proof, and place one clear CTA above the fold.",
    });
  }

  if (seoTotals.clicks > 0 && totalUsers === 0 && ga4PropertyId) {
    opportunities.push({
      severity: "warning",
      title: "SEO traffic exists but GA4 reports no users",
      problem: "Search Console shows clicks, but GA4 returned no users for the same period.",
      impact: "Analytics tracking may be missing, blocked, or connected to the wrong GA4 property.",
      fix: "Check the GA4 measurement ID on the site and confirm the selected GA4 property matches this Search Console property.",
    });
  }

  if (!opportunities.length) {
    opportunities.push({
      severity: "good",
      title: "No major SEO plus analytics mismatch detected",
      problem: "FlowIQ did not find a strong traffic, engagement, or conversion mismatch in the current data.",
      impact: "The connected properties look stable for this period.",
      fix: "Keep monitoring weekly and investigate any pages with high impressions or declining engagement.",
    });
  }

  return {
    connected: {
      gsc: Boolean(propertyUrl && accessToken),
      ga4: Boolean(ga4PropertyId && accessToken),
      gscPropertyUrl: propertyUrl,
      ga4PropertyId,
      ga4PropertyName,
    },
    dateRange: { startDate, endDate },
    seo: {
      metrics: [
        { label: "Clicks", value: numberFormat(seoTotals.clicks), status: seoTotals.clicks > 0 ? "good" : "warning", helper: "GSC organic clicks" },
        { label: "Impressions", value: numberFormat(seoTotals.impressions), status: seoTotals.impressions > 0 ? "good" : "warning", helper: "Search visibility" },
        { label: "CTR", value: percentFormat(seoTotals.ctr), status: seoTotals.ctr >= 0.03 ? "good" : "warning", helper: "Clicks divided by impressions" },
        { label: "Avg position", value: seoTotals.position ? String(Math.round(seoTotals.position * 10) / 10) : "-", status: seoTotals.position && seoTotals.position <= 15 ? "good" : "warning", helper: "Weighted by impressions" },
      ],
      topQueries,
      topPages,
      trend: dateRows.map((row) => ({
        date: row.keys?.[0] ?? "",
        clicks: Math.round(row.clicks ?? 0),
        impressions: Math.round(row.impressions ?? 0),
      })),
    },
    analytics: {
      metrics: [
        { label: "Users", value: numberFormat(totalUsers), status: totalUsers > 0 ? "good" : "warning", helper: "GA4 active users" },
        { label: "Sessions", value: numberFormat(totalSessions), status: totalSessions > 0 ? "good" : "warning", helper: "GA4 sessions" },
        { label: "Engagement", value: percentFormat(avgEngagement), status: avgEngagement >= 0.5 ? "good" : "warning", helper: "Average engagement rate" },
        { label: "Bounce", value: percentFormat(avgBounce), status: avgBounce <= 0.55 ? "good" : "warning", helper: "Average bounce rate" },
      ],
      trafficSources,
      landingPages,
      trend: gaTrendRows.map((row) => ({
        date: gaDimension(row, 0),
        users: Math.round(gaMetric(row, 0)),
        sessions: Math.round(gaMetric(row, 1)),
      })),
    },
    technicalAudit: [
      {
        severity: propertyUrl ? "good" : "critical",
        title: propertyUrl ? "Search Console property selected" : "Search Console property missing",
        problem: propertyUrl ? `${propertyUrl} is connected.` : "No Search Console property is selected.",
        impact: propertyUrl ? "FlowIQ can read query and page data." : "SEO intelligence cannot run without a verified property.",
        fix: propertyUrl ? "No action needed." : "Connect Google Search Console and choose the exact property for this project.",
      },
      {
        severity: ga4PropertyId ? "good" : "warning",
        title: ga4PropertyId ? "GA4 property selected" : "GA4 property missing",
        problem: ga4PropertyId ? `${ga4PropertyName || ga4PropertyId} is selected.` : "No GA4 property is selected.",
        impact: ga4PropertyId ? "FlowIQ can blend SEO and behavior data." : "FlowIQ cannot detect engagement or conversion mismatches.",
        fix: ga4PropertyId ? "No action needed." : "Enable Google Analytics APIs, reconnect Google, and choose the matching GA4 property.",
      },
    ],
    opportunities,
    backlinks: topPages.slice(0, 5).map((page) => ({
      severity: "warning",
      title: "Backlink support opportunity",
      problem: `${page.page} has organic visibility and can benefit from stronger authority.`,
      impact: "Relevant backlinks can help this page defend rankings and move higher for related queries.",
      fix: "Pitch this URL to niche blogs, partner resource pages, local directories, and existing brand mentions.",
    })),
  };
}
