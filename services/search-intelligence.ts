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
  resources?: Array<{
    name: string;
    url: string;
    reason: string;
  }>;
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

function suggestionPriority(severity: IntelligenceInsight["severity"]) {
  if (severity === "critical") return "HIGH";
  if (severity === "warning") return "MEDIUM";
  return "LOW";
}

function suggestionType(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("backlink")) return "BACKLINK_OPPORTUNITY";
  if (normalized.includes("title") || normalized.includes("clicks") || normalized.includes("impressions")) return "CONTENT_BRIEF";
  return "WEBSITE_FIX";
}

async function hasRecentSearchSuggestion(projectId: string, dedupeKey: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const existing = await prisma.intelligenceSuggestion.findFirst({
    where: {
      projectId,
      createdAt: { gte: sevenDaysAgo },
      data: {
        path: ["dedupeKey"],
        equals: dedupeKey,
      },
    },
    select: { id: true },
  });

  return Boolean(existing);
}

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

const foundationalAuthorityResources = [
  {
    name: "Google Business Profile",
    url: "https://www.google.com/business/",
    reason: "Essential local trust signal for businesses with a physical service area or office.",
  },
  {
    name: "Bing Places",
    url: "https://www.bingplaces.com/",
    reason: "Creates a matching business entity on Bing and supports local discovery.",
  },
  {
    name: "Apple Business Connect",
    url: "https://businessconnect.apple.com/",
    reason: "Helps the brand appear accurately in Apple Maps and Apple local surfaces.",
  },
  {
    name: "LinkedIn Company Page",
    url: "https://www.linkedin.com/company/setup/new/",
    reason: "Strong brand profile for B2B trust, team proof, and company entity consistency.",
  },
  {
    name: "Crunchbase",
    url: "https://www.crunchbase.com/",
    reason: "Useful for company/entity credibility, especially for SaaS, agencies, and startups.",
  },
  {
    name: "Yelp for Business",
    url: "https://business.yelp.com/",
    reason: "Helpful for local service businesses and review/profile consistency.",
  },
  {
    name: "Trustpilot",
    url: "https://business.trustpilot.com/",
    reason: "Review profile that can support brand trust and conversion credibility.",
  },
  {
    name: "Clutch",
    url: "https://clutch.co/get-listed",
    reason: "High-value profile for agencies, consultants, software, and B2B service providers.",
  },
  {
    name: "GoodFirms",
    url: "https://www.goodfirms.co/get-listed",
    reason: "Relevant for agencies, software companies, app development, and digital services.",
  },
  {
    name: "DesignRush",
    url: "https://www.designrush.com/agency/register",
    reason: "Useful for web design, branding, marketing, and development agency visibility.",
  },
  {
    name: "Sortlist",
    url: "https://www.sortlist.com/",
    reason: "Agency marketplace profile for marketing, design, and development services.",
  },
  {
    name: "Product Hunt",
    url: "https://www.producthunt.com/",
    reason: "Useful for SaaS/tools when launching a real product or public feature.",
  },
];

function authorityResourcesForPage(pageUrl: string) {
  const normalized = pageUrl.toLowerCase();
  const resources = foundationalAuthorityResources.slice(0, 6);

  if (
    normalized.includes("web") ||
    normalized.includes("design") ||
    normalized.includes("seo") ||
    normalized.includes("marketing") ||
    normalized.includes("agency")
  ) {
    return [
      ...resources,
      foundationalAuthorityResources.find((resource) => resource.name === "Clutch"),
      foundationalAuthorityResources.find((resource) => resource.name === "GoodFirms"),
      foundationalAuthorityResources.find((resource) => resource.name === "DesignRush"),
      foundationalAuthorityResources.find((resource) => resource.name === "Sortlist"),
    ].filter(Boolean) as typeof foundationalAuthorityResources;
  }

  return resources;
}

function buildBacklinkInsights(pageRows: GscRow[], propertyUrl: string): IntelligenceInsight[] {
  if (!propertyUrl) {
    return [
      {
        severity: "warning",
        title: "Connect Search Console before backlink planning",
        problem: "FlowIQ needs the website's Search Console pages before it can prioritize link-building targets.",
        impact: "Without page-level search data, backlink work becomes generic and harder to connect to ranking gains.",
        fix: "Connect Google Search Console, select the exact website property, then run SEO + Analytics sync again.",
        resources: foundationalAuthorityResources.slice(0, 4),
      },
    ];
  }

  if (!pageRows.length) {
    return [
      {
        severity: "warning",
        title: "Build foundational authority profiles",
        problem: "Search Console did not return enough page data yet for page-specific backlink targeting.",
        impact: "A new or low-data site still needs basic trust signals before deeper link-building campaigns make sense.",
        fix: "Create or improve profiles on Google Business Profile, Bing Places, relevant local directories, niche association pages, partner websites, and social brand profiles. Use the same business name, website URL, services, and location everywhere.",
        resources: foundationalAuthorityResources.slice(0, 8),
      },
      {
        severity: "warning",
        title: "Create one linkable asset",
        problem: "The site needs a page that other websites have a clear reason to reference.",
        impact: "Backlinks are easier to earn when the target page has original value, such as data, a checklist, pricing guide, calculator, or local resource.",
        fix: "Publish one strong resource page for the core service, then pitch it to niche blogs, partner pages, local publications, and resource list owners.",
        resources: foundationalAuthorityResources.slice(7, 12),
      },
    ];
  }

  return pageRows.slice(0, 5).map((row) => {
    const page = row.keys?.[0] ?? propertyUrl;
    const impressions = row.impressions ?? 0;
    const clicks = row.clicks ?? 0;
    const position = row.position ?? 0;
    const ctr = row.ctr ?? 0;
    const needsAuthority = impressions > 50 && position > 8;
    const needsClickSupport = impressions > 100 && ctr < 0.03;

    return {
      severity: needsAuthority || needsClickSupport ? "warning" : "good",
      title: needsAuthority ? "Authority gap backlink opportunity" : "Backlink support opportunity",
      problem: `${page} has ${numberFormat(impressions)} impressions, ${numberFormat(clicks)} clicks, and an average position of ${Math.round(position * 10) / 10 || "-"}.`,
      impact: needsAuthority
        ? "This page is visible but needs stronger external authority to push into more valuable ranking positions."
        : "Relevant mentions and backlinks can help this page defend rankings and build topical trust.",
      fix:
        "Prioritize this URL for outreach. Look for niche blogs, local directories, supplier or partner pages, resource lists, guest post targets, and unlinked brand mentions. Pitch the page as a useful reference, not just as a homepage link.",
      resources: authorityResourcesForPage(page).slice(0, 8),
    };
  });
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
    backlinks: buildBacklinkInsights(pageRows, propertyUrl),
  };
}

export async function syncSearchIntelligenceSuggestions(
  projectId: string,
  dashboard: SearchIntelligenceDashboard,
) {
  const insights = [
    ...dashboard.opportunities,
    ...dashboard.technicalAudit,
    ...dashboard.backlinks,
  ].filter((insight) => insight.severity !== "good");

  const created = [];

  for (const insight of insights) {
    const dedupeKey = `search-intelligence:${insight.title}:${insight.problem}`;
    if (await hasRecentSearchSuggestion(projectId, dedupeKey)) continue;

    created.push(
      await prisma.intelligenceSuggestion.create({
        data: {
          projectId,
          type: suggestionType(insight.title) as never,
          priority: suggestionPriority(insight.severity) as never,
          title: insight.title,
          description: `${insight.problem} Impact: ${insight.impact}`,
          data: {
            source: "search_intelligence",
            dedupeKey,
            impact: insight.impact,
            fix: insight.fix,
            severity: insight.severity,
            resources: insight.resources ?? [],
            dateRange: dashboard.dateRange,
            gscPropertyUrl: dashboard.connected.gscPropertyUrl,
            ga4PropertyId: dashboard.connected.ga4PropertyId,
          },
        },
      }),
    );
  }

  return created;
}
