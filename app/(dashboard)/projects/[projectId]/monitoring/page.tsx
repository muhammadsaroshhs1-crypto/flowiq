import { auth } from "@clerk/nextjs/server";
import { formatDistanceToNow } from "date-fns";
import { notFound, redirect } from "next/navigation";

import { HealthCard } from "@/components/monitoring/health-card";
import { ManualCheckForm } from "@/components/monitoring/manual-check-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getProjectById } from "@/lib/projects";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type UptimeJson = { isUp?: boolean; responseTimeMs?: number; statusCode?: number };
type SSLJson = { daysUntilExpiry?: number; expiresAt?: string };
type CWVJson = { score?: number; lcp?: number; cls?: number; inp?: number };
type WebsiteContentItem = {
  type: "Page" | "Post";
  title: string;
  url: string;
  modified?: string;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getLatest<T>(results: Array<{ checkType: string; result: unknown; createdAt: Date; status: string }>, checkType: string) {
  const item = results.find((result) => result.checkType === checkType);
  return item
    ? {
        ...item,
        result: asRecord(item.result) as T,
      }
    : null;
}

function readSiteUrl(config: unknown) {
  const record = asRecord(config);
  return typeof record.siteUrl === "string" ? record.siteUrl.replace(/\/$/, "") : "";
}

function titleText(title: unknown) {
  const record = asRecord(title);
  return typeof record.rendered === "string"
    ? record.rendered.replace(/<[^>]+>/g, "").trim()
    : "Untitled";
}

async function fetchWordPressContent(siteUrl: string): Promise<WebsiteContentItem[]> {
  if (!siteUrl) return [];

  const endpoints = [
    { type: "Page" as const, url: `${siteUrl}/wp-json/wp/v2/pages?per_page=8&_fields=link,title,modified` },
    { type: "Post" as const, url: `${siteUrl}/wp-json/wp/v2/posts?per_page=8&_fields=link,title,modified` },
  ];

  const results = await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      const response = await fetch(endpoint.url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) return [];
      const items = (await response.json()) as Array<{ link?: string; title?: unknown; modified?: string }>;
      return items.map<WebsiteContentItem>((item) => ({
        type: endpoint.type,
        title: titleText(item.title),
        url: item.link ?? siteUrl,
        modified: item.modified,
      }));
    }),
  );

  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

export default async function ProjectMonitoringPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [workspace, project] = await Promise.all([
    getCurrentWorkspace(userId),
    getProjectById(params.projectId),
  ]);

  if (!workspace) redirect("/onboarding");
  if (!project || project.workspaceId !== workspace.id) notFound();

  const [results, alerts] = await Promise.all([
    prisma.monitoringResult.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.alert.findMany({
      where: {
        projectId: params.projectId,
        category: "WEBSITE",
        isResolved: false,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const latestUptime = getLatest<UptimeJson>(results, "UPTIME_CHECK");
  const latestSSL = getLatest<SSLJson>(results, "SSL_CHECK");
  const latestCWV = getLatest<CWVJson>(results, "CWV_CHECK");
  const latestBackup = getLatest<{ message?: string }>(results, "BACKUP_CHECK");
  const websiteIntegration = project.integrations.find(
    (integration) => integration.isConnected && ["WORDPRESS", "SHOPIFY", "WEBFLOW"].includes(integration.type),
  );
  const siteUrl = readSiteUrl(websiteIntegration?.config);
  const contentItems = websiteIntegration?.type === "WORDPRESS" ? await fetchWordPressContent(siteUrl) : [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{project.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Website monitoring</h1>
        </div>
        <form action="/api/monitoring/schedule" method="post" className="hidden">
          <input name="projectId" value={params.projectId} readOnly />
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HealthCard
          label="Uptime"
          value={latestUptime?.result.isUp ? "Up" : latestUptime ? "Down" : "No data"}
          status={latestUptime ? (latestUptime.status as never) : "unknown"}
          lastCheckedAt={latestUptime?.createdAt}
        />
        <HealthCard
          label="SSL"
          value={
            latestSSL?.result.daysUntilExpiry !== undefined
              ? `Valid · expires in ${latestSSL.result.daysUntilExpiry} days`
              : "No data"
          }
          status={latestSSL ? (latestSSL.status as never) : "unknown"}
          lastCheckedAt={latestSSL?.createdAt}
        />
        <HealthCard
          label="Last CWV scan"
          value={
            latestCWV
              ? `Score ${latestCWV.result.score ?? 0} · LCP ${latestCWV.result.lcp ?? 0}s`
              : "No data"
          }
          status={latestCWV ? (latestCWV.status as never) : "unknown"}
          lastCheckedAt={latestCWV?.createdAt}
        />
        <HealthCard
          label="Last backup"
          value={latestBackup ? "OK" : "No data"}
          status={latestBackup ? (latestBackup.status as never) : "unknown"}
          lastCheckedAt={latestBackup?.createdAt}
        />
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Run manual check</CardTitle>
          <CardDescription>
            Run a live website check now. Results are saved immediately for this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManualCheckForm projectId={params.projectId} />
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Connected website content</CardTitle>
          <CardDescription>
            {siteUrl
              ? `FlowIQ is reading public WordPress pages and posts from ${siteUrl}.`
              : "Connect WordPress, Shopify, or Webflow to show website pages here."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contentItems.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Modified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contentItems.map((item) => (
                  <TableRow key={`${item.type}-${item.url}`}>
                    <TableCell><Badge variant="outline">{item.type}</Badge></TableCell>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="max-w-md truncate">
                      <a href={item.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                        {item.url}
                      </a>
                    </TableCell>
                    <TableCell>
                      {item.modified ? formatDistanceToNow(new Date(item.modified), { addSuffix: true }) : "Unknown"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No public WordPress pages were detected yet. Confirm the site URL is correct and that
              /wp-json/wp/v2/pages is reachable.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Check history</CardTitle>
          <CardDescription>Recent monitoring results for this project.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Check type</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detected at</TableHead>
                <TableHead>Resolved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.id}>
                  <TableCell>{result.checkType}</TableCell>
                  <TableCell className="max-w-md truncate">
                    {JSON.stringify(result.result).slice(0, 120)}
                  </TableCell>
                  <TableCell><Badge variant="outline">{result.status}</Badge></TableCell>
                  <TableCell>{formatDistanceToNow(result.createdAt, { addSuffix: true })}</TableCell>
                  <TableCell>{result.status === "ok" ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No monitoring results yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Website alerts</CardTitle>
          <CardDescription>Open website alerts for this project.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length ? (
            alerts.map((alert) => (
              <div key={alert.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{alert.title}</p>
                  <Badge variant="outline">{alert.severity}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                {alert.actionRequired ? (
                  <p className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
                    {alert.actionRequired}
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No open website alerts.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
