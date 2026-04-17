import { auth } from "@clerk/nextjs/server";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { TopicMapSetup, TopicMapView } from "@/components/intelligence/topic-map-view";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
  const [suggestions, socialItems] = await Promise.all([
    prisma.intelligenceSuggestion.findMany({
      where: { projectId: params.projectId },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 12,
    }),
    prisma.socialQueueItem.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

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
                <CardTitle>Topical authority is not in this project module list</CardTitle>
                <CardDescription>
                  You can still generate and test a topical map here. Add the module during project setup for cleaner reporting later.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}
          {topicMap ? (
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

        <TabsContent value="suggestions" className="space-y-3">
          {suggestions.length ? (
            suggestions.map((suggestion) => (
              <Card key={suggestion.id} className="rounded-lg">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{suggestion.title}</CardTitle>
                      <CardDescription>{suggestion.description}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{suggestion.priority}</Badge>
                      <Badge variant="outline">{suggestion.type}</Badge>
                      <Badge variant="outline">{suggestion.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          ) : (
            <Card className="rounded-lg border-dashed">
              <CardHeader>
                <CardTitle>No intelligence suggestions yet</CardTitle>
                <CardDescription>
                  Run Amazon analysis or generate a topical map to start filling this queue with approval-ready actions.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants({ variant: "outline" })} href={`/projects/${params.projectId}/amazon`}>
              Run Amazon analysis
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href={`/projects/${params.projectId}/intelligence`}>
              Generate topical map
            </Link>
          </div>
        </TabsContent>

        <TabsContent value="social-queue" className="space-y-3">
          {socialItems.length ? (
            socialItems.map((item) => (
              <Card key={item.id} className="rounded-lg">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>{item.sourceTitle}</CardTitle>
                      <CardDescription>
                        {item.platform} draft created {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                </CardHeader>
              </Card>
            ))
          ) : (
            <Card className="rounded-lg border-dashed">
              <CardHeader>
                <CardTitle>No social drafts yet</CardTitle>
                <CardDescription>
                  Connect WordPress and publish a post webhook, or open the Social page to manage review-ready drafts.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          <Link className={buttonVariants({ variant: "outline" })} href={`/projects/${params.projectId}/social`}>
            Open social queue
          </Link>
        </TabsContent>
      </Tabs>
    </section>
  );
}
