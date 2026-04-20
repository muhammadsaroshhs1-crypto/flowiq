import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { ProjectProvider } from "@/contexts/project-context";
import { getProjectById } from "@/lib/projects";
import { getCurrentWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const baseTabs = [
  { href: "", label: "Overview" },
  { href: "/pipelines", label: "Pipelines" },
  { href: "/search-intelligence", label: "SEO + Analytics" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/reports", label: "Reports" },
  { href: "/integrations", label: "Integrations" },
];

export default async function ProjectLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { projectId: string };
}>) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [workspace, project] = await Promise.all([
    getCurrentWorkspace(userId),
    getProjectById(params.projectId),
  ]);

  if (!workspace) redirect("/onboarding");
  if (!project || project.workspaceId !== workspace.id) notFound();

  const industryTabs = [
    project.industry === "AMAZON" || project.industry === "MULTI"
      ? { href: "/amazon", label: "Amazon" }
      : null,
    project.modules.includes("Social media sync")
      ? { href: "/social", label: "Social" }
      : null,
    project.modules.includes("Website monitoring & alerts") ||
    project.modules.includes("Website maintenance")
      ? { href: "/monitoring", label: "Monitoring" }
      : null,
  ].filter(Boolean) as Array<{ href: string; label: string }>;

  const tabs = [...baseTabs.slice(0, 5), ...industryTabs, baseTabs[5]];

  return (
    <ProjectProvider
      value={{
        project: {
          id: project.id,
          name: project.name,
          clientName: project.clientName,
          industry: project.industry,
          status: project.status,
          modules: project.modules,
        },
      }}
    >
      <div className="space-y-6">
        <nav className="flex gap-2 overflow-x-auto rounded-lg border bg-background p-2">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={`/projects/${project.id}${tab.href}`}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </ProjectProvider>
  );
}
