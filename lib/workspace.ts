import { clerkClient } from "@clerk/nextjs/server";
import type { MemberRole, Workspace, WorkspaceMember } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export class WorkspaceInviteError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "INVITE_FAILED", status = 500) {
    super(message);
    this.name = "WorkspaceInviteError";
    this.code = code;
    this.status = status;
  }
}

export type WorkspaceWithMembers = Workspace & {
  members: Array<WorkspaceMember & { user: { id: string; clerkId: string; email: string; name: string | null; avatarUrl: string | null } }>;
};

export async function getCurrentWorkspace(userId: string): Promise<Workspace | null> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: userId }, { clerkId: userId }],
    },
    select: { id: true },
  });

  if (!user) {
    return null;
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  return membership?.workspace ?? null;
}

export async function getCurrentWorkspaceMembership(clerkId: string) {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  if (!user) {
    return null;
  }

  return prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    include: {
      workspace: true,
      user: {
        select: {
          id: true,
          clerkId: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });
}

export async function inviteMember(
  workspaceId: string,
  email: string,
  role: MemberRole,
  appUrl?: string,
): Promise<{ mode: "added_existing_user" | "invited" }> {
  const normalizedEmail = email.trim().toLowerCase();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true },
  });

  if (!workspace) {
    throw new WorkspaceInviteError("Workspace not found.", "WORKSPACE_NOT_FOUND", 404);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: existingUser.id,
        },
      },
    });

    if (existingMember) {
      throw new WorkspaceInviteError("This person is already a member of this workspace.", "ALREADY_MEMBER", 409);
    }

    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: existingUser.id,
        role,
      },
    });

    return { mode: "added_existing_user" };
  }

  const client = await clerkClient();

  try {
    await client.invitations.createInvitation({
      emailAddress: normalizedEmail,
      ignoreExisting: true,
      publicMetadata: {
        workspaceId,
        workspaceName: workspace.name,
        role,
      },
      redirectUrl: new URL("/sign-up", appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").toString(),
    });
  } catch (error) {
    const clerkMessage =
      typeof error === "object" &&
      error !== null &&
      "errors" in error &&
      Array.isArray((error as { errors?: unknown }).errors)
        ? ((error as { errors: Array<{ message?: string; longMessage?: string }> }).errors[0]?.longMessage ??
          (error as { errors: Array<{ message?: string; longMessage?: string }> }).errors[0]?.message)
        : undefined;

    throw new WorkspaceInviteError(
      clerkMessage ?? "Clerk rejected the invitation. Check that your Vercel domain is allowed in Clerk and the email is valid.",
      "CLERK_INVITE_FAILED",
      400,
    );
  }

  return { mode: "invited" };
}
