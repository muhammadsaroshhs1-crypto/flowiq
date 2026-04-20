"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchIntelligenceDashboard } from "@/services/search-intelligence";

const tabs = [
  { id: "seo", label: "SEO Overview" },
  { id: "analytics", label: "Analytics Overview" },
  { id: "technical", label: "Technical Audit" },
  { id: "opportunities", label: "Opportunities & Insights" },
  { id: "backlinks", label: "Authority Opportunities" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const statusStyles = {
  good: "border-green-200 bg-green-50 text-green-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-red-200 bg-red-50 text-red-700",
};

function StatusBadge({ status }: { status: "good" | "warning" | "critical" }) {
  const label = status === "good" ? "Good" : status === "warning" ? "Needs improvement" : "Critical";
  return <Badge className={statusStyles[status]}>{label}</Badge>;
}

function MetricGrid({ metrics }: { metrics: SearchIntelligenceDashboard["seo"]["metrics"] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="rounded-lg">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <CardDescription>{metric.label}</CardDescription>
              <StatusBadge status={metric.status} />
            </div>
            <CardTitle className="text-2xl">{metric.value}</CardTitle>
            <CardDescription>{metric.helper}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function MiniBars({
  data,
  valueKey,
}: {
  data: Array<Record<string, string | number>>;
  valueKey: string;
}) {
  const max = Math.max(...data.map((item) => Number(item[valueKey] ?? 0)), 1);

  return (
    <div className="flex h-32 items-end gap-1 rounded-lg border p-3">
      {data.slice(-28).map((item, index) => {
        const value = Number(item[valueKey] ?? 0);
        return (
          <div
            key={`${valueKey}-${index}`}
            className="min-w-1 flex-1 rounded-t bg-primary/70"
            style={{ height: `${Math.max(6, (value / max) * 100)}%` }}
            title={`${value}`}
          />
        );
      })}
    </div>
  );
}

function SimpleTable({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: Array<Record<string, string | number>>;
}) {
  const columns = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {columns.map((column) => (
                    <th key={column} className="px-3 py-2 font-medium capitalize">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-b last:border-0">
                    {columns.map((column) => (
                      <td key={column} className="max-w-xs truncate px-3 py-2">{row[column]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No rows returned for this date range.</p>
        )}
      </CardContent>
    </Card>
  );
}

function InsightList({
  insights,
}: {
  insights: SearchIntelligenceDashboard["opportunities"];
}) {
  return (
    <div className="grid gap-3">
      {insights.map((insight) => (
        <Card key={`${insight.title}-${insight.problem}`} className="rounded-lg">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{insight.title}</CardTitle>
                <CardDescription>{insight.problem}</CardDescription>
              </div>
              <StatusBadge status={insight.severity} />
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="text-sm font-medium">Impact</p>
              <p className="mt-1 text-sm text-muted-foreground">{insight.impact}</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">Fix</p>
              <p className="mt-1 text-sm text-amber-900">{insight.fix}</p>
            </div>
            {insight.resources?.length ? (
              <div className="rounded-md border p-3 md:col-span-2">
                <p className="text-sm font-medium">Relevant places to research</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {insight.resources.map((resource) => (
                    <a
                      key={`${insight.title}-${resource.name}`}
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border p-3 transition-colors hover:bg-muted"
                    >
                      <span className="text-sm font-medium underline underline-offset-4">{resource.name}</span>
                      <p className="mt-1 text-xs text-muted-foreground">{resource.reason}</p>
                    </a>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  These are research targets, not guaranteed backlinks. Prioritize quality, relevance, and real brand profiles.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}

export function SearchIntelligenceWorkspace({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("seo");
  const [dashboard, setDashboard] = useState<SearchIntelligenceDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/search-intelligence`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        dashboard?: SearchIntelligenceDashboard;
        error?: string;
      };

      if (!response.ok || !data.dashboard) {
        toast.error(data.error ?? "Could not load SEO and Analytics intelligence");
        return;
      }

      setDashboard(data.dashboard);
    } catch {
      toast.error("Could not load SEO and Analytics intelligence");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeContent = useMemo(() => {
    if (!dashboard) return null;

    if (activeTab === "seo") {
      return (
        <div className="space-y-4">
          <MetricGrid metrics={dashboard.seo.metrics} />
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Organic trend</CardTitle>
              <CardDescription>Clicks over the last 28 days from Search Console.</CardDescription>
            </CardHeader>
            <CardContent>
              <MiniBars data={dashboard.seo.trend} valueKey="clicks" />
            </CardContent>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <SimpleTable title="Top queries" description="Queries bringing search visibility." rows={dashboard.seo.topQueries} />
            <SimpleTable title="Top pages" description="Pages receiving organic clicks." rows={dashboard.seo.topPages} />
          </div>
        </div>
      );
    }

    if (activeTab === "analytics") {
      return (
        <div className="space-y-4">
          <MetricGrid metrics={dashboard.analytics.metrics} />
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>User trend</CardTitle>
              <CardDescription>Active users from the selected GA4 property.</CardDescription>
            </CardHeader>
            <CardContent>
              <MiniBars data={dashboard.analytics.trend} valueKey="users" />
            </CardContent>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <SimpleTable title="Traffic sources" description="Where visitors come from." rows={dashboard.analytics.trafficSources} />
            <SimpleTable title="Landing pages" description="First pages users land on." rows={dashboard.analytics.landingPages} />
          </div>
        </div>
      );
    }

    if (activeTab === "technical") {
      return <InsightList insights={dashboard.technicalAudit} />;
    }

    if (activeTab === "backlinks") {
      return <InsightList insights={dashboard.backlinks} />;
    }

    return <InsightList insights={dashboard.opportunities} />;
  }, [activeTab, dashboard]);

  return (
    <div className="space-y-5">
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>SEO + Analytics Intelligence</CardTitle>
              <CardDescription>
                Unified Search Console and GA4 analysis for the selected project.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={dashboard?.connected.gsc ? "default" : "outline"}>
                GSC {dashboard?.connected.gsc ? "connected" : "missing"}
              </Badge>
              <Badge variant={dashboard?.connected.ga4 ? "default" : "outline"}>
                GA4 {dashboard?.connected.ga4 ? "connected" : "missing"}
              </Badge>
              <Button variant="outline" onClick={loadDashboard} disabled={isLoading}>
                {isLoading ? "Loading..." : "Sync now"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {dashboard ? (
          <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            <p className="break-all">GSC: {dashboard.connected.gscPropertyUrl || "Choose a Search Console property"}</p>
            <p>GA4: {dashboard.connected.ga4PropertyName || dashboard.connected.ga4PropertyId || "Choose a GA4 property"}</p>
          </CardContent>
        ) : null}
      </Card>

      <div className="flex gap-2 overflow-x-auto rounded-lg border bg-background p-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? <LoadingState /> : activeContent}
    </div>
  );
}
