import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const updateSocialItemSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "SCHEDULED"]).optional(),
  draft: z.string().min(1).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

async function authorizeItem(clerkId: string, projectId: string, itemId: string) {
  const workspace = await getCurrentWorkspace(clerkId);
  if (!workspace) return null;

  return prisma.socialQueueItem.findFirst({
    where: {
      id: itemId,
      projectId,
      project: { workspaceId: workspace.id },
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { projectId: string; itemId: string } },
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

  const parsed = updateSocialItemSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid social item update.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const item = await authorizeItem(userId, params.projectId, params.itemId);
    if (!item) {
      return Response.json({ error: "Social queue item not found.", code: "SOCIAL_ITEM_NOT_FOUND" }, { status: 404 });
    }

    const updated = await prisma.socialQueueItem.update({
      where: { id: params.itemId },
      data: {
        status: parsed.data.status,
        draft: parsed.data.draft,
        scheduledAt:
          parsed.data.scheduledAt === undefined
            ? undefined
            : parsed.data.scheduledAt
              ? new Date(parsed.data.scheduledAt)
              : null,
      },
    });

    return Response.json({ item: updated });
  } catch (error) {
    console.error("Failed to update social queue item.", error);
    return Response.json({ error: "Could not update social queue item.", code: "SOCIAL_ITEM_UPDATE_FAILED" }, { status: 500 });
  }
}
