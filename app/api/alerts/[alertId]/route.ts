import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { resolveAlert } from "@/services/alert-service";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const alertActionSchema = z.object({
  action: z.enum(["read", "resolve"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: { alertId: string } },
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

  const parsed = alertActionSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid alert action.", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    const workspace = await getCurrentWorkspace(userId);
    const alert = workspace
      ? await prisma.alert.findFirst({
          where: { id: params.alertId, workspaceId: workspace.id },
          select: { id: true },
        })
      : null;

    if (!alert) {
      return Response.json(
        { error: "Alert not found.", code: "ALERT_NOT_FOUND" },
        { status: 404 },
      );
    }

    const updated =
      parsed.data.action === "resolve"
        ? await resolveAlert(params.alertId, userId)
        : await prisma.alert.update({
            where: { id: params.alertId },
            data: { isRead: true },
          });

    return Response.json({ alert: updated });
  } catch (error) {
    console.error("Failed to update alert.", error);
    return Response.json(
      { error: "Could not update alert.", code: "ALERT_UPDATE_FAILED" },
      { status: 500 },
    );
  }
}
