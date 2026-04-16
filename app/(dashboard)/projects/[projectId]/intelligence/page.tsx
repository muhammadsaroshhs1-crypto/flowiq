import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { TopicMapSetup, TopicMapView } from "@/components/intelligence/topic-map-view";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { prisma } from "@/lib/prisma";
import { getProjectById } from "@/lib/projects";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type PillarTopic = {
  topic: string;
  targetKeyword: string;
  searchIntent: string;
  priority: "high" | "medium" | "low";
  exists: boolean;
  existingUrl?: string;
};

type ClusterTopic = {
  pillar: string;
  topic: string;
  targetKeyword: string;
  wordCount: number;
  priority: "high" | "medium" | "low";
  status: "existing" | "gap" | "in_progress";
  existingUrl?: string;
};

export default async function ProjectIntelligencePage({
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

  const topicMap = await prisma.topicMap.findFirst({
    where: { projectId: params.projectId },
    orderBy: { lastGeneratedAt: "desc" },
  });

  const hasTopicalAuthorityModule = project.modules.includes("Topical authority engine");

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{project.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Intelligence</h1>
      </div>

      <Tabs defaultValue="topical-authority" className="space-y-4">
        <TabsList>
          <TabsTrigger value="topical-authority">Topical Authority</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="social-queue">Social Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="topical-authority" className="space-y-4">
          {!hasTopicalAuthorityModule ? (
            <Card className="rounded-lg border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle>Module not active</CardTitle>
                <CardDescription>
                  Enable Topical authority engine in the project modules to use this workflow.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : topicMap ? (
            <TopicMapView
              projectId={params.projectId}
              topicMap={{
                id: topicMap.id,
                niche: topicMap.niche,
                pillarTopics: topicMap.pillarTopics as PillarTopic[],
                clusterTopics: topicMap.clusterTopics as ClusterTopic[],
                coverageScore: topicMap.coverageScore,
                lastGeneratedAt: topicMap.lastGeneratedAt.toISOString(),
              }}
            />
          ) : (
            <TopicMapSetup projectId={params.projectId} />
          )}
        </TabsContent>

        <TabsContent value="suggestions">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Suggestions</CardTitle>
              <CardDescription>Suggestion queues are populated in later intelligence steps.</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>

        <TabsContent value="social-queue">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Social Queue</CardTitle>
              <CardDescription>Content-to-social sync is built in Step 7.</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
