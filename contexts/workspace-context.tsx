"use client";

import { createContext, useContext } from "react";

type WorkspaceContextUser = {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

type WorkspaceContextWorkspace = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceContextMember = {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  createdAt: string;
};

type WorkspaceContextValue = {
  workspace: WorkspaceContextWorkspace;
  currentUser: WorkspaceContextUser;
  currentMember: WorkspaceContextMember;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: Readonly<{
  value: WorkspaceContextValue;
  children: React.ReactNode;
}>) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider.");
  }

  return context;
}
