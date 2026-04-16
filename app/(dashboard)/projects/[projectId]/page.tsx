import { auth } from "@clerk/nextjs/server";
import { formatDistanceToNow } from "date-fns";
import { Globe, Layers, Pencil, Search, ShoppingCart } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getProjectById } from "@/lib/projects";
import { getCurrentWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const industryIcons = {
  SEO: Search,
  AMAZON: ShoppingCart,
  WEB_DESIGN: Globe,
  MULTI: Layers,
};

const statusClasses = {
  ACTIVE: "border-green-200 bg-green-50 text-green-700",
  PAUSED: "border-amber-200 bg-amber-50 text-amber-700",
  COMPLETED: "border-blue-200 bg-blue-50 text-blue-700",
  ARCHIVED: "border-gray-200 bg-gray-50 text-gray-700",
};

export default async function ProjectOverviewPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const [workspace, project] = await Promise.all([
    getCurrentWorkspace(userId),
    getProjectById(params.projectId),
  ]);

  if (!workspace) {
    redirect("/onboarding");
  }

  if (!project || project.workspaceId !== workspace.id) {
    notFound();
  }

  const Icon = industryIcons[project.industry];

  return (
    <section className="space-y-6">
      <div className="rounded-lg border bg-background p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className="rounded-lg border bg-muted p-3">
              <Icon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
                <Badge className={cn("border", statusClasses[project.status])}>
                  {project.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {project.clientName ?? "No client name"} · {project.industry} · updated{" "}
                {formatDistanceToNow(project.updatedAt, { addSuffix: true })}
              </p>
            </div>
          </div>
          <Button variant="outline">
            <Pencil className="h-4 w-4" />
            Quick edit
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {project.modules.map((module) => (
              <Card key={module} className="rounded-lg">
                <CardHeader>
                  <CardTitle>{module}</CardTitle>
                  <CardDescription>Active module</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Workflows and intelligence for this module connect in later steps.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Assigned team</CardTitle>
                <CardDescription>{project.members.length} project members</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {project.members.length ? (
                  project.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {member.user.name ?? member.user.email}
                        </p>
                        <p className="text-xs text-muted-foreground">{member.user.email}</p>
                      </div>
                      <Badge variant="outline">{member.role}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No team members assigned.</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Recent alerts</CardTitle>
                <CardDescription>
                  {project._count.alerts} unresolved alerts for this project
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {project.alerts.length ? (
                  project.alerts.map((alert) => (
                    <div key={alert.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <Badge variant="outline">{alert.severity}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No open alerts yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pipelines">
          <Placeholder title="Pipelines" text="Pipeline execution is built in Step 5." />
        </TabsContent>
        <TabsContent value="intelligence">
          <Placeholder title="Intelligence" text="SEO and Amazon intelligence arrive in later steps." />
        </TabsContent>
        <TabsContent value="integrations">
          <Placeholder title="Integrations" text="Project connections are built in Step 11." />
        </TabsContent>
        <TabsContent value="settings">
          <Placeholder title="Settings" text="Project settings will be expanded as modules land." />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
    </Card>
  );
}
