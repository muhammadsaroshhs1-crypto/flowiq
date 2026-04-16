import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { IntegrationCard } from "@/components/integrations/integration-card";
import { INTEGRATION_REGISTRY, INTEGRATION_TYPES } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { getProjectById } from "@/lib/projects";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectIntegrationsPage({
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

  const integrations = await prisma.projectIntegration.findMany({
    where: { projectId: params.projectId },
  });

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{project.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {INTEGRATION_TYPES.map((type) => (
          <IntegrationCard
            key={type}
            projectId={params.projectId}
            type={type}
            registry={INTEGRATION_REGISTRY[type]}
            integration={integrations.find((integration) => integration.type === type)}
          />
        ))}
      </div>
    </section>
  );
}
