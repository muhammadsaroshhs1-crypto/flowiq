import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { SearchIntelligenceWorkspace } from "@/components/intelligence/search-intelligence-workspace";
import { getProjectById } from "@/lib/projects";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SearchIntelligencePage({
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

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{project.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">SEO + Analytics</h1>
      </div>
      <SearchIntelligenceWorkspace projectId={params.projectId} />
    </section>
  );
}

