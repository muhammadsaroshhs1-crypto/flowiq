import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { updateTaskAndCascade } from "@/lib/pipelines";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const updateTaskSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"]).optional(),
  notes: z.string().nullable().optional(),
  assignedMemberId: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { taskId: string } },
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

  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid task update.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const workspace = await getCurrentWorkspace(userId);
    const task = workspace
      ? await prisma.task.findFirst({
          where: { id: params.taskId, stage: { pipeline: { project: { workspaceId: workspace.id } } } },
          select: { id: true },
        })
      : null;

    if (!task) {
      return Response.json({ error: "Task not found.", code: "TASK_NOT_FOUND" }, { status: 404 });
    }

    const updated = await updateTaskAndCascade(params.taskId, parsed.data);
    return Response.json({ task: updated });
  } catch (error) {
    console.error("Failed to update task.", error);
    return Response.json({ error: "Could not update task.", code: "TASK_UPDATE_FAILED" }, { status: 500 });
  }
}
