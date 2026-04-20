import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ACTIVE_INTEGRATION_TYPES, INTEGRATION_REGISTRY } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function WorkspaceIntegrationsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const workspace = await getCurrentWorkspace(userId);
  if (!workspace) redirect("/onboarding");

  const projects = await prisma.project.findMany({
    where: { workspaceId: workspace.id, status: { not: "ARCHIVED" } },
    include: { integrations: true },
    orderBy: { updatedAt: "desc" },
  });

  const visibleTypes = ACTIVE_INTEGRATION_TYPES.filter((type) =>
    ["WORDPRESS", "SHOPIFY", "WEBFLOW", "AMAZON", "GOOGLE_SEARCH_CONSOLE", "GOOGLE_ANALYTICS", "META", "LINKEDIN"].includes(type),
  );

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Workspace overview</p>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              {visibleTypes.map((type) => (
                <TableHead key={type}>{INTEGRATION_REGISTRY[type].name}</TableHead>
              ))}
              <TableHead>Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="font-medium">{project.name}</TableCell>
                {visibleTypes.map((type) => {
                  const connected = project.integrations.some(
                    (integration) => integration.type === type && integration.isConnected,
                  );
                  return (
                    <TableCell key={type}>
                      <span className={connected ? "text-green-700" : "text-muted-foreground"}>
                        {connected ? "Connected" : "Not connected"}
                      </span>
                    </TableCell>
                  );
                })}
                <TableCell>
                  <Link
                    href={`/projects/${project.id}/integrations`}
                    className="text-sm font-medium underline underline-offset-4"
                  >
                    Go to project
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleTypes.length + 2} className="py-8 text-center text-muted-foreground">
                  No projects yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
