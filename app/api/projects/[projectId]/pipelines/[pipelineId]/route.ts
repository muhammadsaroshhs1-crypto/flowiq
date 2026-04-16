import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getPipelineForExecution } from "@/lib/pipelines";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const updatePipelineSchema = z.object({
  name: z.string().trim().min(2).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

async function authorize(clerkId: string, projectId: string, pipelineId: string) {
  const workspace = await getCurrentWorkspace(clerkId);
  if (!workspace) return false;

  const pipeline = await prisma.pipeline.findFirst({
    where: { id: pipelineId, projectId, project: { workspaceId: workspace.id } },
    select: { id: true },
  });

  return Boolean(pipeline);
}

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string; pipelineId: string } },
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "You must be signed in.", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    if (!(await authorize(userId, params.projectId, params.pipelineId))) {
      return Response.json({ error: "Pipeline not found.", code: "PIPELINE_NOT_FOUND" }, { status: 404 });
    }

    const pipeline = await getPipelineForExecution(params.projectId, params.pipelineId);
    return Response.json({ pipeline });
  } catch (error) {
    console.error("Failed to load pipeline.", error);
    return Response.json({ error: "Could not load pipeline.", code: "PIPELINE_LOAD_FAILED" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { projectId: string; pipelineId: string } },
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

  const parsed = updatePipelineSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid pipeline update.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    if (!(await authorize(userId, params.projectId, params.pipelineId))) {
      return Response.json({ error: "Pipeline not found.", code: "PIPELINE_NOT_FOUND" }, { status: 404 });
    }

    const pipeline = await prisma.pipeline.update({
      where: { id: params.pipelineId },
      data: {
        name: parsed.data.name,
        status: parsed.data.status,
        dueDate: parsed.data.dueDate === undefined ? undefined : parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      },
    });

    return Response.json({ pipeline });
  } catch (error) {
    console.error("Failed to update pipeline.", error);
    return Response.json({ error: "Could not update pipeline.", code: "PIPELINE_UPDATE_FAILED" }, { status: 500 });
  }
}
