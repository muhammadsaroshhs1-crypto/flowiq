import { auth } from "@clerk/nextjs/server";
import { format } from "date-fns";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CreatePipelineDialog } from "@/components/pipelines/create-pipeline-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getProjectPipelines } from "@/lib/pipelines";
import { getProjectById } from "@/lib/projects";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectPipelinesPage({
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

  const pipelines = await getProjectPipelines(params.projectId);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{project.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Pipelines</h1>
        </div>
        <CreatePipelineDialog projectId={project.id} members={project.members} />
      </div>

      {pipelines.length ? (
        <div className="grid gap-4">
          {pipelines.map((pipeline) => (
            <Link key={pipeline.id} href={`/projects/${project.id}/pipelines/${pipeline.id}`}>
              <Card className="rounded-lg transition hover:shadow-md">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{pipeline.name}</CardTitle>
                      <CardDescription>
                        {pipeline.moduleType} · {pipeline.progress.completedStages}/{pipeline.progress.totalStages} stages done
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{pipeline.status}</Badge>
                      {pipeline.dueDate ? (
                        <Badge variant="outline">Due {format(pipeline.dueDate, "MMM d, yyyy")}</Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={pipeline.progress.percentComplete} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {pipeline.progress.completedTasks}/{pipeline.progress.totalTasks} tasks complete
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="rounded-lg border-dashed">
          <CardHeader>
            <CardTitle>No pipelines yet</CardTitle>
            <CardDescription>
              Add a template pipeline or start with a custom workflow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreatePipelineDialog projectId={project.id} members={project.members} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
