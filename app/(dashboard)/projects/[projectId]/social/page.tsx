import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { SocialQueueItem } from "@/components/social/social-queue-item";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getProjectById } from "@/lib/projects";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectSocialPage({
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

  const [items, groupedStats] = await Promise.all([
    prisma.socialQueueItem.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.socialQueueItem.groupBy({
      by: ["status"],
      where: { projectId: params.projectId },
      _count: { status: true },
    }),
  ]);

  const stats = {
    PENDING_REVIEW: 0,
    APPROVED: 0,
    SCHEDULED: 0,
    PUBLISHED: 0,
  };

  for (const stat of groupedStats) {
    if (stat.status in stats) {
      stats[stat.status as keyof typeof stats] = stat._count.status;
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{project.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Social queue</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Pending review" value={stats.PENDING_REVIEW} />
        <StatCard label="Approved" value={stats.APPROVED} />
        <StatCard label="Scheduled" value={stats.SCHEDULED} />
        <StatCard label="Published this month" value={stats.PUBLISHED} />
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Review drafts</CardTitle>
          <CardDescription>
            Generated social posts from published content appear here for approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length ? (
            items.map((item) => <SocialQueueItem key={item.id} item={item} />)
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No social drafts yet. Connect WordPress and publish a post to populate the queue.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
