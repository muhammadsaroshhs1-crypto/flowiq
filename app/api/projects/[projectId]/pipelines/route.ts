import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getProjectPipelines, createPipelineFromTemplate } from "@/lib/pipelines";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const createPipelineSchema = z.object({
  templateName: z.string().optional(),
  isCustom: z.boolean().default(false),
  name: z.string().trim().min(2),
  dueDate: z.string().datetime().optional().nullable(),
  assignedMemberId: z.string().optional().nullable(),
});

async function authorizeProject(clerkId: string, projectId: string) {
  const workspace = await getCurrentWorkspace(clerkId);
  if (!workspace) return false;

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true, industry: true },
  });

  return project;
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

    const pipelines = await getProjectPipelines(params.projectId);
    return Response.json({ pipelines });
  } catch (error) {
    console.error("Failed to list pipelines.", error);
    return Response.json({ error: "Could not list pipelines.", code: "PIPELINE_LIST_FAILED" }, { status: 500 });
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

  const parsed = createPipelineSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid pipeline details.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const project = await authorizeProject(userId, params.projectId);
    if (!project) {
      return Response.json({ error: "Project not found.", code: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    const dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;

    if (!parsed.data.isCustom && parsed.data.templateName) {
      const pipeline = await createPipelineFromTemplate(params.projectId, parsed.data.templateName, {
        name: parsed.data.name,
        dueDate,
        assignedMemberId: parsed.data.assignedMemberId,
      });
      return Response.json({ pipeline }, { status: 201 });
    }

    const pipeline = await prisma.pipeline.create({
      data: {
        projectId: params.projectId,
        name: parsed.data.name,
        description: "Custom workflow pipeline.",
        industry: project.industry,
        moduleType: "CUSTOM",
        dueDate,
        stages: {
          create: {
            name: "First stage",
            description: "Add tasks for this custom workflow.",
            order: 1,
            assignedMemberId: parsed.data.assignedMemberId,
          },
        },
      },
      include: { stages: true },
    });

    return Response.json({ pipeline }, { status: 201 });
  } catch (error) {
    console.error("Failed to create pipeline.", error);
    return Response.json({ error: "Could not create pipeline.", code: "PIPELINE_CREATE_FAILED" }, { status: 500 });
  }
}
