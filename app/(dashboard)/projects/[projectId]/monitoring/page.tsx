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
            Queue a monitoring job from the API. Results appear after the worker processes it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManualCheckForm projectId={params.projectId} />
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
