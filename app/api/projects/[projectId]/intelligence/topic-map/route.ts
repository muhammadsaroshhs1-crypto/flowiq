import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";
import { generateTopicMap } from "@/services/topical-authority";

const existingPageSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  content: z.string().optional(),
});

const topicMapSchema = z.object({
  niche: z.string().trim().min(3),
  targetAudience: z.string().trim().min(3),
  existingPages: z.array(existingPageSchema).default([]),
});

async function authorizeProject(clerkId: string, projectId: string) {
  const workspace = await getCurrentWorkspace(clerkId);
  if (!workspace) return null;

  return prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    include: { integrations: true },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "You must be signed in.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const project = await authorizeProject(userId, params.projectId);
    if (!project) {
      return Response.json({ error: "Project not found.", code: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    const topicMap = await prisma.topicMap.findFirst({
      where: { projectId: params.projectId },
      orderBy: { lastGeneratedAt: "desc" },
    });

    return Response.json({ topicMap });
  } catch (error) {
    console.error("Failed to load topic map.", error);
    return Response.json({ error: "Could not load topic map.", code: "TOPIC_MAP_LOAD_FAILED" }, { status: 500 });
  }
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

  const parsed = topicMapSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid topic map input.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const project = await authorizeProject(userId, params.projectId);
    if (!project) {
      return Response.json({ error: "Project not found.", code: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    const topicMap = await generateTopicMap({
      projectId: params.projectId,
      niche: parsed.data.niche,
      targetAudience: parsed.data.targetAudience,
      existingPages: parsed.data.existingPages,
    });

    return Response.json({ topicMap }, { status: 201 });
  } catch (error) {
    console.error("Failed to generate topic map.", error);
    const message = error instanceof Error ? error.message : "Could not generate topic map.";
    const status = message.includes("once per project per hour") ? 429 : 500;

    return Response.json(
      { error: message, code: status === 429 ? "RATE_LIMITED" : "TOPIC_MAP_GENERATE_FAILED" },
      { status },
    );
  }
}
