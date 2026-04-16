import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";
import { generateSocialPost } from "@/services/social-sync";

const regenerateSchema = z.object({
  itemId: z.string().min(1),
  platform: z.enum(["LINKEDIN", "INSTAGRAM", "FACEBOOK", "TWITTER"]),
});

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

  const parsed = regenerateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid regenerate request.", code: "VALIDATION_ERROR" }, { status: 400 });
  }

  try {
    const workspace = await getCurrentWorkspace(userId);
    const item = workspace
      ? await prisma.socialQueueItem.findFirst({
          where: {
            id: parsed.data.itemId,
            projectId: params.projectId,
            project: { workspaceId: workspace.id },
          },
        })
      : null;

    if (!item) {
      return Response.json({ error: "Social queue item not found.", code: "SOCIAL_ITEM_NOT_FOUND" }, { status: 404 });
    }

    const draft = await generateSocialPost(parsed.data.platform, {
      title: item.sourceTitle,
      url: item.sourceUrl,
      excerpt: item.draft.slice(0, 500),
      categories: [],
    });

    const updated = await prisma.socialQueueItem.update({
      where: { id: item.id },
      data: {
        platform: parsed.data.platform,
        draft,
        status: "PENDING_REVIEW",
      },
    });

    return Response.json({ item: updated });
  } catch (error) {
    console.error("Failed to regenerate social draft.", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not regenerate social draft.", code: "SOCIAL_REGENERATE_FAILED" },
      { status: 500 },
    );
  }
}
