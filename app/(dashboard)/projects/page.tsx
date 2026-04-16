import { auth } from "@clerk/nextjs/server";
import type { Industry, ProjectStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProjectsByWorkspace } from "@/lib/projects";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const industries = ["ALL", "SEO", "AMAZON", "WEB_DESIGN", "MULTI"] as const;
const statuses = ["ALL", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;

type ProjectsPageProps = {
  searchParams?: {
    industry?: string;
    status?: string;
  };
};

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const workspace = await getCurrentWorkspace(userId);

  if (!workspace) {
    redirect("/onboarding");
  }

  const [projects, members] = await Promise.all([
    getProjectsByWorkspace(workspace.id),
    prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const selectedIndustry = industries.includes(searchParams?.industry as never)
    ? searchParams?.industry
    : "ALL";
  const selectedStatus = statuses.includes(searchParams?.status as never)
    ? searchParams?.status
    : "ALL";

  const filteredProjects = projects.filter((project) => {
    const industryMatches =
      selectedIndustry === "ALL" || project.industry === (selectedIndustry as Industry);
    const statusMatches =
      selectedStatus === "ALL" || project.status === (selectedStatus as ProjectStatus);

    return industryMatches && statusMatches;
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Workspace projects</p>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        </div>
        <CreateProjectDialog members={members} />
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border bg-background p-3">
        <form className="flex flex-wrap gap-3">
          <select
            name="industry"
            defaultValue={selectedIndustry}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry === "ALL" ? "All industries" : industry}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={selectedStatus}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status === "ALL" ? "All statuses" : status}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            Apply filters
          </Button>
        </form>
      </div>

      {filteredProjects.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <Card className="rounded-lg border-dashed">
          <CardHeader className="items-center text-center">
            <div className="rounded-lg border bg-muted p-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              Create your first client workspace and choose the modules FlowIQ should manage.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <CreateProjectDialog members={members} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
