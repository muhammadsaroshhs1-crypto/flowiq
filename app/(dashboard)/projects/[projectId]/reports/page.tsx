import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MonthlyPlanButton } from "@/components/reports/monthly-plan-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getSeoReport, type ReportWindow } from "@/services/seo-reporting";

export const dynamic = "force-dynamic";

const reportWindows: Array<{ label: string; value: ReportWindow }> = [
  { label: "Biweekly", value: 15 },
  { label: "Monthly", value: 30 },
  { label: "90 days", value: 90 },
  { label: "6 months", value: 180 },
];

function numberFormat(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function percentFormat(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

function decimalFormat(value: number) {
  return String(Math.round(value * 10) / 10);
}

function DeltaBadge({ value, inverse = false }: { value: number; inverse?: boolean }) {
  const good = inverse ? value < 0 : value > 0;
  const bad = inverse ? value > 10 : value < -10;
  return (
    <Badge variant="outline" className={bad ? "border-red-200 bg-red-50 text-red-700" : good ? "border-green-200 bg-green-50 text-green-700" : ""}>
      {value > 0 ? "+" : ""}{percentFormat(value)}
    </Badge>
  );
}

function MetricCard({
  label,
  value,
  previous,
  delta,
  inverse,
}: {
  label: string;
  value: string;
  previous: string;
  delta: number;
  inverse?: boolean;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardDescription>{label}</CardDescription>
          <DeltaBadge value={delta} inverse={inverse} />
        </div>
        <CardTitle className="text-2xl">{value}</CardTitle>
        <CardDescription>Previous period: {previous}</CardDescription>
      </CardHeader>
    </Card>
  );
}

async function authorizeProject(clerkId: string, projectId: string) {
  const workspace = await getCurrentWorkspace(clerkId);
  if (!workspace) return null;

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });

  return project;
}

export default async function ProjectReportsPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams?: { window?: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const project = await authorizeProject(userId, params.projectId);
  if (!project) notFound();

  const requestedWindow = Number(searchParams?.window ?? 30);
  const windowDays = reportWindows.some((item) => item.value === requestedWindow)
    ? (requestedWindow as ReportWindow)
    : 30;
  const report = await getSeoReport(params.projectId, windowDays);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {report.project.clientName ?? report.project.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">SEO reporting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Current period {report.ranges.current.startDate} to {report.ranges.current.endDate}, compared with {report.ranges.previous.startDate} to {report.ranges.previous.endDate}.
          </p>
        </div>
        <MonthlyPlanButton projectId={params.projectId} monthlyPlanExists={report.monthlyPlanExists} />
      </div>

      <div className="flex flex-wrap gap-2">
        {reportWindows.map((item) => (
          <Link
            key={item.value}
            href={`/projects/${params.projectId}/reports?window=${item.value}`}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              item.value === windowDays ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Organic clicks"
          value={numberFormat(report.seo.current.clicks)}
          previous={numberFormat(report.seo.previous.clicks)}
          delta={report.seo.deltas.clicks}
        />
        <MetricCard
          label="Impressions"
          value={numberFormat(report.seo.current.impressions)}
          previous={numberFormat(report.seo.previous.impressions)}
          delta={report.seo.deltas.impressions}
        />
        <MetricCard
          label="CTR"
          value={percentFormat(report.seo.current.ctr * 100)}
          previous={percentFormat(report.seo.previous.ctr * 100)}
          delta={report.seo.deltas.ctr}
        />
        <MetricCard
          label="Average position"
          value={report.seo.current.position ? decimalFormat(report.seo.current.position) : "-"}
          previous={report.seo.previous.position ? decimalFormat(report.seo.previous.position) : "-"}
          delta={report.seo.deltas.position}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="GA4 users"
          value={numberFormat(report.analytics.current.users)}
          previous={numberFormat(report.analytics.previous.users)}
          delta={report.analytics.deltas.users}
        />
        <MetricCard
          label="GA4 sessions"
          value={numberFormat(report.analytics.current.sessions)}
          previous={numberFormat(report.analytics.previous.sessions)}
          delta={report.analytics.deltas.sessions}
        />
        <MetricCard
          label="Engagement rate"
          value={percentFormat(report.analytics.current.engagementRate * 100)}
          previous={percentFormat(report.analytics.previous.engagementRate * 100)}
          delta={report.analytics.deltas.engagementRate}
        />
        <MetricCard
          label="Bounce rate"
          value={percentFormat(report.analytics.current.bounceRate * 100)}
          previous={percentFormat(report.analytics.previous.bounceRate * 100)}
          delta={report.analytics.deltas.bounceRate}
          inverse
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Work completed</CardTitle>
            <CardDescription>
              {report.work.completedTasks} completed tasks from {report.work.totalTasksTouched} touched tasks. Completion rate: {report.work.completionRate}%.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(report.work.statusCounts).map(([status, count]) => (
                <Badge key={status} variant="outline">{status}: {count}</Badge>
              ))}
            </div>
            {report.work.completedTaskList.length ? (
              <div className="space-y-2">
                {report.work.completedTaskList.map((task) => (
                  <div key={`${task.pipeline}-${task.stage}-${task.title}`} className="rounded-md border p-3">
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{task.pipeline} / {task.stage}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No completed tasks were found for this period yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Operations summary</CardTitle>
            <CardDescription>Alerts, suggestions, and technical checks in this reporting window.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="text-sm text-muted-foreground">Alerts created</p>
              <p className="text-2xl font-semibold">{report.operations.alertsCreated}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-sm text-muted-foreground">Alerts resolved</p>
              <p className="text-2xl font-semibold">{report.operations.alertsResolved}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-sm text-muted-foreground">Suggestions created</p>
              <p className="text-2xl font-semibold">{report.operations.suggestionsCreated}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-sm text-muted-foreground">Monitoring checks</p>
              <p className="text-2xl font-semibold">{report.operations.monitoringChecks}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>FlowIQ interpretation</CardTitle>
          <CardDescription>Plain-English points for the report and next actions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {report.insights.map((insight) => (
            <div key={insight.title} className="rounded-md border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-medium">{insight.title}</p>
                <Badge variant="outline">{insight.severity}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{insight.detail}</p>
              <p className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900">{insight.recommendation}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
