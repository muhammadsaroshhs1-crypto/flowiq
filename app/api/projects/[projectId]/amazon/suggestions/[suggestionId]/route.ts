import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const updateSuggestionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().optional(),
});

async function authorizeSuggestion(clerkId: string, projectId: string, suggestionId: string) {
  const workspace = await getCurrentWorkspace(clerkId);
  if (!workspace) return null;

  return prisma.intelligenceSuggestion.findFirst({
    where: {
      id: suggestionId,
      projectId,
      project: { workspaceId: workspace.id },
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { projectId: string; suggestionId: string } },
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

  const parsed = updateSuggestionSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid suggestion update.", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    const suggestion = await authorizeSuggestion(
      userId,
      params.projectId,
      params.suggestionId,
    );

    if (!suggestion) {
      return Response.json(
        { error: "Suggestion not found.", code: "SUGGESTION_NOT_FOUND" },
        { status: 404 },
      );
    }

    const existingData =
      suggestion.data && typeof suggestion.data === "object" && !Array.isArray(suggestion.data)
        ? (suggestion.data as Record<string, unknown>)
        : {};

    const updated = await prisma.intelligenceSuggestion.update({
      where: { id: params.suggestionId },
      data: {
        status: parsed.data.status,
        approvedAt: parsed.data.status === "APPROVED" ? new Date() : null,
        approvedBy: parsed.data.status === "APPROVED" ? userId : null,
        data:
          parsed.data.status === "REJECTED"
            ? ({
                ...existingData,
                rejectionReason: parsed.data.rejectionReason ?? null,
              } as Prisma.InputJsonValue)
            : undefined,
      },
    });

    return Response.json({ suggestion: updated });
  } catch (error) {
    console.error("Failed to update Amazon suggestion.", error);
    return Response.json(
      { error: "Could not update suggestion.", code: "SUGGESTION_UPDATE_FAILED" },
      { status: 500 },
    );
  }
}
