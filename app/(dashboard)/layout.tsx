import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { getCurrentWorkspaceMembership } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const membership = await getCurrentWorkspaceMembership(userId);

  if (!membership) {
    redirect("/onboarding");
  }

  const contextValue = {
    workspace: {
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      plan: membership.workspace.plan,
      ownerId: membership.workspace.ownerId,
      createdAt: membership.workspace.createdAt.toISOString(),
      updatedAt: membership.workspace.updatedAt.toISOString(),
    },
    currentUser: membership.user,
    currentMember: {
      id: membership.id,
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
    },
  };

  return (
    <WorkspaceProvider value={contextValue}>
      <div className="min-h-screen bg-muted/30">
        <Sidebar />
        <div className="min-h-screen lg:pl-72">
          <TopNav />
          <main className="p-6">{children}</main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
