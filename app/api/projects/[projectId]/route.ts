import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { getProjectById, updateProject } from "@/lib/projects";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const updateProjectSchema = z.object({
  name: z.string().trim().min(2).optional(),
  clientName: z.string().trim().nullable().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  modules: z.array(z.string().trim().min(1)).optional(),
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
  targets: z.record(z.string(), z.unknown()).nullable().optional(),
});

async function authorizeProject(clerkId: string, projectId: string) {
  const workspace = await getCurrentWorkspace(clerkId);

  if (!workspace) {
    return null;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      workspaceId: workspace.id,
    },
  });

  return project ? workspace : null;
}

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } },
) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: "You must be signed in.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    const workspace = await authorizeProject(userId, params.projectId);

    if (!workspace) {
      return Response.json(
        { error: "Project not found.", code: "PROJECT_NOT_FOUND" },
        { status: 404 },
      );
    }

    const project = await getProjectById(params.projectId);
    return Response.json({ project });
  } catch (error) {
    console.error("Failed to load project.", error);
    return Response.json(
      { error: "Could not load project.", code: "PROJECT_LOAD_FAILED" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: "You must be signed in.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const parsed = updateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid project update.", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    const workspace = await authorizeProject(userId, params.projectId);

    if (!workspace) {
      return Response.json(
        { error: "Project not found.", code: "PROJECT_NOT_FOUND" },
        { status: 404 },
      );
    }

    const project = await updateProject(params.projectId, {
      ...parsed.data,
      settings: parsed.data.settings as Prisma.InputJsonValue | null | undefined,
      targets: parsed.data.targets as Prisma.InputJsonValue | null | undefined,
    });
    return Response.json({ project });
  } catch (error) {
    console.error("Failed to update project.", error);
    return Response.json(
      { error: "Could not update project.", code: "PROJECT_UPDATE_FAILED" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { projectId: string } },
) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: "You must be signed in.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    const workspace = await authorizeProject(userId, params.projectId);

    if (!workspace) {
      return Response.json(
        { error: "Project not found.", code: "PROJECT_NOT_FOUND" },
        { status: 404 },
      );
    }

    const project = await updateProject(params.projectId, { status: "ARCHIVED" });
    return Response.json({ project });
  } catch (error) {
    console.error("Failed to archive project.", error);
    return Response.json(
      { error: "Could not archive project.", code: "PROJECT_ARCHIVE_FAILED" },
      { status: 500 },
    );
  }
}
