"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function MonthlyPlanButton({
  projectId,
  monthlyPlanExists,
}: {
  projectId: string;
  monthlyPlanExists: boolean;
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  async function createPlan() {
    setIsCreating(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/reports/monthly-plan`, {
        method: "POST",
      });
      const data = (await response.json()) as { pipelineId?: string; error?: string };

      if (!response.ok || data.error) {
        toast.error(data.error ?? "Could not create monthly SEO plan");
        return;
      }

      toast.success("Monthly SEO plan is ready");
      router.refresh();
    } catch {
      toast.error("Could not create monthly SEO plan");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Button onClick={createPlan} disabled={isCreating || monthlyPlanExists}>
      {monthlyPlanExists ? "Monthly plan active" : isCreating ? "Creating..." : "Create monthly SEO plan"}
    </Button>
  );
}
