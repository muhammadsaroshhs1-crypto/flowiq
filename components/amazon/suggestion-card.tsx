"use client";

import type {
  IntelligenceSuggestion,
  SuggestionPriority,
  SuggestionStatus,
} from "@prisma/client";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const priorityClasses: Record<SuggestionPriority, string> = {
  HIGH: "border-l-red-500",
  MEDIUM: "border-l-amber-500",
  LOW: "border-l-green-500",
};

const priorityBadgeClasses: Record<SuggestionPriority, string> = {
  HIGH: "bg-red-50 text-red-700 border-red-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-green-50 text-green-700 border-green-200",
};

type SuggestionData = {
  currentValue?: string | number;
  suggestedValue?: string | number;
  expectedImpact?: string;
  keyword?: string;
  estimatedWeeklyWaste?: number;
};

function readSuggestionData(data: unknown): SuggestionData {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as SuggestionData) : {};
}

export function SuggestionCard({
  suggestion,
  projectId,
}: {
  suggestion: IntelligenceSuggestion;
  projectId: string;
}) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const data = readSuggestionData(suggestion.data);

  async function updateStatus(status: Extract<SuggestionStatus, "APPROVED" | "REJECTED">) {
    setIsUpdating(true);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/amazon/suggestions/${suggestion.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const result = (await response.json()) as { error?: string };

      if (!response.ok || result.error) {
        toast.error(result.error ?? "Could not update suggestion");
        return;
      }

      toast.success(`Suggestion ${status.toLowerCase()}`);
      router.refresh();
    } catch {
      toast.error("Could not update suggestion");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <Card className={cn("rounded-lg border-l-4", priorityClasses[suggestion.priority])}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge className={cn("border", priorityBadgeClasses[suggestion.priority])}>
                {suggestion.priority}
              </Badge>
              <Badge variant="outline">{suggestion.type}</Badge>
              <Badge variant="outline">{suggestion.status}</Badge>
            </div>
            <CardTitle className="mt-3">{suggestion.title}</CardTitle>
            <CardDescription className="mt-1">{suggestion.description}</CardDescription>
          </div>
          {suggestion.status === "PENDING" ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => updateStatus("APPROVED")} disabled={isUpdating}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatus("REJECTED")}
                disabled={isUpdating}
              >
                Reject
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.currentValue !== undefined || data.suggestedValue !== undefined ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted p-3 text-sm">
            <span>{String(data.currentValue ?? "Current")}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{String(data.suggestedValue ?? "Suggested")}</span>
          </div>
        ) : null}
        {data.expectedImpact ? (
          <Badge variant="outline">{data.expectedImpact}</Badge>
        ) : null}
      </CardContent>
    </Card>
  );
}
