"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const onboardingSchema = z.object({
  workspaceName: z.string().trim().min(2, "Workspace name must be at least 2 characters."),
  userName: z.string().trim().min(1, "Your name is required."),
  primaryIndustry: z.enum(["SEO", "AMAZON", "WEB_DESIGN", "MULTI"]),
});

const industryLabels = {
  SEO: "SEO Agency",
  AMAZON: "Amazon Seller",
  WEB_DESIGN: "Web Design Agency",
  MULTI: "Multiple / Mixed",
} as const;

type OnboardingFormProps = {
  initialName: string;
};

export function OnboardingForm({ initialName }: OnboardingFormProps) {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [userName, setUserName] = useState(initialName);
  const [primaryIndustry, setPrimaryIndustry] = useState<keyof typeof industryLabels>("SEO");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = onboardingSchema.safeParse({
      workspaceName,
      userName,
      primaryIndustry,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const data = (await response.json()) as
        | { workspaceId: string; slug: string }
        | { error: string; code: string };

      if (!response.ok || "error" in data) {
        setError("error" in data ? data.error : "Could not create workspace.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong while creating your workspace.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6 space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="workspaceName">Workspace name</Label>
        <Input
          id="workspaceName"
          value={workspaceName}
          onChange={(event) => setWorkspaceName(event.target.value)}
          placeholder="Acme Growth Studio"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="userName">Your name</Label>
        <Input
          id="userName"
          value={userName}
          onChange={(event) => setUserName(event.target.value)}
          placeholder="Your name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Industry you primarily work in</Label>
        <Select
          value={primaryIndustry}
          onValueChange={(value) => setPrimaryIndustry(value as keyof typeof industryLabels)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(industryLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating workspace..." : "Create workspace"}
      </Button>
    </form>
  );
}
