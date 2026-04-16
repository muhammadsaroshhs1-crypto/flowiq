import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";
import { generateContentBrief } from "@/services/topical-authority";

const briefSchema = z.object({
  topic: z.string().trim().min(2),
  targetKeyword: z.string().trim().min(2),
  action: z.enum(["generate", "add_to_pipeline"]).default("generate"),
  brief: z.string().optional(),
});

async function authorizeProject(clerkId: string, projectId: string) {
  const workspace = await getCurrentWorkspace(clerkId);
  if (!workspace) return null;

  return prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
}

async function addBriefToOnPagePipeline(projectId: string, topic: string, brief: string) {
  const pipeline = await prisma.pipeline.findFirst({
    where: {
      projectId,
      moduleType: "ON_PAGE",
    },
    include: {
      stages: {
        where: { name: "Content optimisation" },
        orderBy: { order: "asc" },
      },
    },
  });

  const stage = pipeline?.stages[0];
  if (!pipeline || !stage) {
    throw new Error("No On-Page pipeline with a Content optimisation stage was found.");
  }

  const lastTask = await prisma.task.findFirst({
    where: { stageId: stage.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  return prisma.task.create({
    data: {
      stageId: stage.id,
      title: `Write: ${topic}`,
      description: brief,
      notes: brief,
      order: (lastTask?.order ?? 0) + 1,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "You must be signed in.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body.", code: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = briefSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid brief request.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const project = await authorizeProject(userId, params.projectId);
    if (!project) {
      return Response.json({ error: "Project not found.", code: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    if (parsed.data.action === "add_to_pipeline") {
      if (!parsed.data.brief) {
        return Response.json({ error: "Brief content is required.", code: "BRIEF_REQUIRED" }, { status: 400 });
      }

      const task = await addBriefToOnPagePipeline(params.projectId, parsed.data.topic, parsed.data.brief);
      return Response.json({ task });
    }

    const topicMap = await prisma.topicMap.findFirst({
      where: { projectId: params.projectId },
      orderBy: { lastGeneratedAt: "desc" },
    });

    const clusterTopics = Array.isArray(topicMap?.clusterTopics)
      ? (topicMap?.clusterTopics as Array<{ existingUrl?: string }>)
      : [];
    const existingTopicUrls = clusterTopics
      .map((topic) => topic.existingUrl)
      .filter((url): url is string => Boolean(url));

    const brief = await generateContentBrief({
      topic: parsed.data.topic,
      targetKeyword: parsed.data.targetKeyword,
      niche: topicMap?.niche ?? project.name,
      existingTopicUrls,
    });

    return Response.json({ brief });
  } catch (error) {
    console.error("Failed to handle content brief request.", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Could not handle content brief request.",
        code: "CONTENT_BRIEF_FAILED",
      },
      { status: 500 },
    );
  }
}
