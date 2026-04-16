import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { createProject, getProjectsByWorkspace } from "@/lib/projects";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const createProjectSchema = z.object({
  name: z.string().trim().min(2),
  clientName: z.string().trim().optional().nullable(),
  industry: z.enum(["SEO", "AMAZON", "WEB_DESIGN", "MULTI"]),
  modules: z.array(z.string().trim().min(1)).min(1),
  assignments: z
    .array(
      z.object({
        userId: z.string().min(1),
        role: z.enum(["MANAGER", "EXECUTOR", "VIEWER"]),
        assignedModules: z.array(z.string()).optional(),
      }),
    )
    .default([]),
});

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: "You must be signed in.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    const workspace = await getCurrentWorkspace(userId);

    if (!workspace) {
      return Response.json(
        { error: "Workspace not found.", code: "WORKSPACE_NOT_FOUND" },
        { status: 404 },
      );
    }

    const projects = await getProjectsByWorkspace(workspace.id);
    return Response.json({ projects });
  } catch (error) {
    console.error("Failed to list projects.", error);
    return Response.json(
      { error: "Could not list projects.", code: "PROJECT_LIST_FAILED" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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

  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid project details.", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    const workspace = await getCurrentWorkspace(userId);

    if (!workspace) {
      return Response.json(
        { error: "Workspace not found.", code: "WORKSPACE_NOT_FOUND" },
        { status: 404 },
      );
    }

    const validMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: workspace.id,
        userId: { in: parsed.data.assignments.map((assignment) => assignment.userId) },
      },
      select: { userId: true },
    });
    const validMemberIds = new Set(validMembers.map((member) => member.userId));

    const project = await createProject({
      workspaceId: workspace.id,
      name: parsed.data.name,
      clientName: parsed.data.clientName || null,
      industry: parsed.data.industry,
      modules: parsed.data.modules,
      assignments: parsed.data.assignments.filter((assignment) =>
        validMemberIds.has(assignment.userId),
      ),
    });

    return Response.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Failed to create project.", error);
    return Response.json(
      { error: "Could not create project.", code: "PROJECT_CREATE_FAILED" },
      { status: 500 },
    );
  }
}
