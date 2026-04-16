import { clerkClient } from "@clerk/nextjs/server";
import type { MemberRole, Workspace, WorkspaceMember } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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
): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true },
  });

  if (!workspace) {
    throw new Error("Workspace not found.");
  }

  const client = await clerkClient();

  await client.invitations.createInvitation({
    emailAddress: email,
    publicMetadata: {
      workspaceId,
      workspaceName: workspace.name,
      role,
    },
    redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/onboarding`,
  });
}
