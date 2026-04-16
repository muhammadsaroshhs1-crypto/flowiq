"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AmazonTargets = {
  targetACOS?: number;
  targetROAS?: number;
  monthlyAdBudget?: number;
  campaignFocus?: "Launch" | "Growth" | "Efficiency";
};

const focusOptions = [
  {
    value: "Launch",
    label: "Launch",
    description: "More aggressive bidding to gather data and rank faster.",
  },
  {
    value: "Growth",
    label: "Growth",
    description: "Balanced scaling while watching profitability.",
  },
  {
    value: "Efficiency",
    label: "Efficiency",
    description: "Tighter spend control and wasted-click reduction.",
  },
] as const;

export function TargetsForm({
  projectId,
  initialTargets,
}: {
  projectId: string;
  initialTargets: AmazonTargets;
}) {
  const router = useRouter();
  const [targetACOS, setTargetACOS] = useState(initialTargets.targetACOS ?? 20);
  const [targetROAS, setTargetROAS] = useState(initialTargets.targetROAS ?? 4);
  const [monthlyAdBudget, setMonthlyAdBudget] = useState(initialTargets.monthlyAdBudget ?? 3000);
  const [campaignFocus, setCampaignFocus] = useState<"Launch" | "Growth" | "Efficiency">(
    initialTargets.campaignFocus ?? "Growth",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);

  async function saveTargets() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets: {
            targetACOS,
            targetROAS,
            monthlyAdBudget,
            campaignFocus,
          },
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok || data.error) {
        toast.error(data.error ?? "Could not save targets");
        return;
      }

      toast.success("Amazon targets saved");
      router.refresh();
    } catch {
      toast.error("Could not save targets");
    } finally {
      setIsSaving(false);
    }
  }

  async function runAnalysis() {
    setIsAnalysing(true);

    try {
      await saveTargets();
      const response = await fetch(`/api/projects/${projectId}/amazon/analyse`, {
        method: "POST",
      });
      const data = (await response.json()) as { suggestionsCreated?: number; error?: string };

      if (!response.ok || data.error) {
        toast.error(data.error ?? "Could not run analysis");
        return;
      }

      toast.success(`${data.suggestionsCreated ?? 0} suggestions created`);
      router.refresh();
    } catch {
      toast.error("Could not run analysis");
    } finally {
      setIsAnalysing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="acos">Target ACOS (%)</label>
          <span className="text-sm font-semibold">{targetACOS}%</span>
        </div>
        <input
          id="acos"
          type="range"
          min={5}
          max={60}
          value={targetACOS}
          onChange={(event) => setTargetACOS(Number(event.target.value))}
          className="w-full"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="roas">Target ROAS (x)</label>
          <span className="text-sm font-semibold">{targetROAS}x</span>
        </div>
        <input
          id="roas"
          type="range"
          min={1}
          max={10}
          step={0.1}
          value={targetROAS}
          onChange={(event) => setTargetROAS(Number(event.target.value))}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="budget">Monthly ad budget ($)</label>
        <Input
          id="budget"
          type="number"
          min={0}
          value={monthlyAdBudget}
          onChange={(event) => setMonthlyAdBudget(Number(event.target.value))}
        />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Campaign focus</p>
        <div className="grid gap-3 md:grid-cols-3">
          {focusOptions.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-lg border p-3 text-sm ${
                campaignFocus === option.value ? "border-primary bg-primary/5" : "bg-background"
              }`}
            >
              <input
                type="radio"
                className="sr-only"
                checked={campaignFocus === option.value}
                onChange={() => setCampaignFocus(option.value)}
              />
              <span className="font-medium">{option.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={saveTargets} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save targets"}
        </Button>
        <Button variant="outline" onClick={runAnalysis} disabled={isAnalysing}>
          {isAnalysing ? "Running analysis..." : "Run analysis"}
        </Button>
      </div>
    </div>
  );
}
