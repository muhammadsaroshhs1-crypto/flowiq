import { auth } from "@clerk/nextjs/server";
import { format } from "date-fns";
import { redirect } from "next/navigation";

import { InviteMemberForm } from "@/components/settings/invite-member-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const workspace = await getCurrentWorkspace(userId);

  if (!workspace) {
    redirect("/onboarding");
  }

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: workspace.id },
    include: {
      user: {
        select: { name: true, email: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{workspace.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Basic workspace details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="workspaceName">Workspace name</label>
            <Input id="workspaceName" defaultValue={workspace.name} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Plan</p>
            <Badge variant="outline">{workspace.plan}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Team members</CardTitle>
          <CardDescription>Invite and review workspace access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InviteMemberForm />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.user.name ?? "Unnamed"}</TableCell>
                  <TableCell>{member.user.email}</TableCell>
                  <TableCell><Badge variant="outline">{member.role}</Badge></TableCell>
                  <TableCell>{format(member.createdAt, "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" disabled>
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-red-200">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Delete workspace requires typing the workspace name. The destructive action API is intentionally not enabled yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input placeholder={workspace.name} />
          <Button variant="destructive" disabled>
            Delete workspace
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
