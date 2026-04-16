"use client";

import type { IntelligenceSuggestion } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SuggestionWithProject = IntelligenceSuggestion & {
  project: { id: string; name: string };
};

const priorityClasses = {
  HIGH: "border-l-red-500",
  MEDIUM: "border-l-amber-500",
  LOW: "border-l-green-500",
};

export function SuggestionsQueue({ suggestions }: { suggestions: SuggestionWithProject[] }) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function updateSuggestion(suggestion: SuggestionWithProject, status: "APPROVED" | "REJECTED") {
    setUpdatingId(suggestion.id);

    try {
      const response = await fetch(
        `/api/projects/${suggestion.project.id}/amazon/suggestions/${suggestion.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const data = (await response.json()) as { error?: string };

      if (!response.ok || data.error) {
        toast.error(data.error ?? "Could not update suggestion");
        return;
      }

      toast.success(`Suggestion ${status.toLowerCase()}`);
      router.refresh();
    } catch {
      toast.error("Could not update suggestion");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Intelligence suggestions</CardTitle>
        <CardDescription>Pending approvals across all projects.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.length ? (
          suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={cn("rounded-lg border border-l-4 p-3", priorityClasses[suggestion.priority])}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{suggestion.project.name}</p>
                  <p className="truncate text-sm font-medium">{suggestion.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{suggestion.type}</Badge>
                    <Badge variant="outline">{suggestion.priority}</Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={updatingId === suggestion.id}
                    onClick={() => updateSuggestion(suggestion, "APPROVED")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updatingId === suggestion.id}
                    onClick={() => updateSuggestion(suggestion, "REJECTED")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No pending suggestions yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
