import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { inviteMember, WorkspaceInviteError } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["MANAGER", "EXECUTOR", "VIEWER"]),
});

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

  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid invite details.", code: "VALIDATION_ERROR" },
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

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        user: { clerkId: userId },
      },
      select: { role: true },
    });

    if (!member || !["OWNER", "MANAGER"].includes(member.role)) {
      return Response.json(
        { error: "You do not have permission to invite members.", code: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const requestOrigin = request.headers.get("origin") ?? undefined;
    const result = await inviteMember(workspace.id, parsed.data.email, parsed.data.role, requestOrigin);

    return Response.json({
      ok: true,
      message:
        result.mode === "added_existing_user"
          ? "Existing FlowIQ user added to this workspace."
          : "Invitation sent.",
      mode: result.mode,
    });
  } catch (error) {
    console.error("Failed to invite workspace member.", error);
    if (error instanceof WorkspaceInviteError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return Response.json(
      { error: "Could not send invitation.", code: "INVITE_FAILED" },
      { status: 500 },
    );
  }
}
