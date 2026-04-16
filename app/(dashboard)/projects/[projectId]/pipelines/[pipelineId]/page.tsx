import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { PipelineExecutionView } from "@/components/pipelines/pipeline-execution-view";
import { getPipelineForExecution } from "@/lib/pipelines";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function PipelineExecutionPage({
  params,
}: {
  params: { projectId: string; pipelineId: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getCurrentWorkspace(userId);
  if (!workspace) redirect("/onboarding");

  const pipeline = await getPipelineForExecution(params.projectId, params.pipelineId);

  if (!pipeline || pipeline.project.workspaceId !== workspace.id) {
    notFound();
  }

  return <PipelineExecutionView pipeline={pipeline} />;
}
