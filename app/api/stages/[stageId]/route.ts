import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const updateStageSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "REVIEW", "COMPLETED", "BLOCKED"]).optional(),
  assignedMemberId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { stageId: string } },
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

  const parsed = updateStageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid stage update.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const workspace = await getCurrentWorkspace(userId);
    const stage = workspace
      ? await prisma.stage.findFirst({
          where: { id: params.stageId, pipeline: { project: { workspaceId: workspace.id } } },
        })
      : null;

    if (!stage) {
      return Response.json({ error: "Stage not found.", code: "STAGE_NOT_FOUND" }, { status: 404 });
    }

    const updated = await prisma.stage.update({
      where: { id: params.stageId },
      data: {
        status: parsed.data.status,
        assignedMemberId: parsed.data.assignedMemberId,
        dueDate: parsed.data.dueDate === undefined ? undefined : parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        completedAt: parsed.data.status === "COMPLETED" ? new Date() : parsed.data.status ? null : undefined,
      },
    });

    return Response.json({ stage: updated });
  } catch (error) {
    console.error("Failed to update stage.", error);
    return Response.json({ error: "Could not update stage.", code: "STAGE_UPDATE_FAILED" }, { status: 500 });
  }
}
