import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const workspace = await getCurrentWorkspace(userId);

  if (workspace) {
    redirect("/dashboard");
  }

  const user = await currentUser();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-xl rounded-lg border bg-background p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">FlowIQ setup</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Create your workspace
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set up the home base where your projects, alerts, and intelligence workflows will live.
        </p>
        <OnboardingForm initialName={fullName || user?.username || ""} />
      </div>
    </main>
  );
}
