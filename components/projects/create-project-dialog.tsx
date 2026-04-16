"use client";

import type { Industry } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type WorkspaceMemberOption = {
  id: string;
  userId: string;
  role: string;
  user: {
    name: string | null;
    email: string;
  };
};

const modulesByIndustry: Record<Industry, string[]> = {
  SEO: [
    "On-page SEO",
    "Off-page SEO",
    "Technical SEO",
    "Social media sync",
    "Topical authority engine",
    "Monthly reporting",
  ],
  AMAZON: [
    "Listing optimisation",
    "PPC / ads intelligence",
    "Inventory monitoring",
    "Competitor tracking",
    "Monthly reporting",
  ],
  WEB_DESIGN: [
    "New website build",
    "Ecommerce build",
    "Blog / content site",
    "Website maintenance",
    "Website monitoring & alerts",
  ],
  MULTI: [
    "On-page SEO",
    "PPC / ads intelligence",
    "Website maintenance",
    "Social media sync",
    "Monthly reporting",
  ],
};

const projectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters."),
  industry: z.enum(["SEO", "AMAZON", "WEB_DESIGN", "MULTI"]),
  modules: z.array(z.string()).min(1, "Select at least one active module."),
});

export function CreateProjectDialog({
  members,
}: {
  members: WorkspaceMemberOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [industry, setIndustry] = useState<Industry>("SEO");
  const [modules, setModules] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableModules = useMemo(() => modulesByIndustry[industry], [industry]);

  function resetModules(nextIndustry: Industry) {
    setIndustry(nextIndustry);
    setModules([]);
  }

  function toggleModule(module: string) {
    setModules((current) =>
      current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module],
    );
  }

  function goNext() {
    setError(null);

    if (step === 1 && !name.trim()) {
      setError("Project name is required.");
      return;
    }

    if (step === 2 && modules.length === 0) {
      setError("Select at least one active module.");
      return;
    }

    setStep((current) => Math.min(current + 1, 3));
  }

  async function submit() {
    setError(null);

    const parsed = projectSchema.safeParse({ name, industry, modules });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the project details.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          clientName: clientName || null,
          industry,
          modules,
          assignments: Object.entries(assignments)
            .filter(([, role]) => role !== "UNASSIGNED")
            .map(([userId, role]) => ({
              userId,
              role,
              assignedModules: modules,
            })),
        }),
      });

      const data = (await response.json()) as
        | { project: { id: string } }
        | { error: string; code: string };

      if (!response.ok || "error" in data) {
        setError("error" in data ? data.error : "Could not create project.");
        return;
      }

      setOpen(false);
      setStep(1);
      setName("");
      setClientName("");
      setIndustry("SEO");
      setModules([]);
      setAssignments({});
      router.push(`/projects/${data.project.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong while creating the project.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>New project</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Step {step} of 3: define scope, modules, and team ownership.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className={cn(
                "h-2 flex-1 rounded-full",
                item <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Project name</Label>
              <Input
                id="projectName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Q2 SEO growth sprint"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientName">Client / brand name</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Acme"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <select
                id="industry"
                value={industry}
                onChange={(event) => resetModules(event.target.value as Industry)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="SEO">SEO</option>
                <option value="AMAZON">Amazon</option>
                <option value="WEB_DESIGN">Web Design</option>
                <option value="MULTI">Multi</option>
              </select>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {availableModules.map((module) => (
              <label
                key={module}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition",
                  modules.includes(module) ? "border-primary bg-primary/5" : "hover:bg-muted",
                )}
              >
                <input
                  type="checkbox"
                  checked={modules.includes(module)}
                  onChange={() => toggleModule(module)}
                  className="mt-1"
                />
                <span>{module}</span>
              </label>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            {members.length ? (
              members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-4 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {member.user.name ?? member.user.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.user.email}
                    </p>
                  </div>
                  <select
                    value={assignments[member.userId] ?? "UNASSIGNED"}
                    onChange={(event) =>
                      setAssignments((current) => ({
                        ...current,
                        [member.userId]: event.target.value,
                      }))
                    }
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="UNASSIGNED">Unassigned</option>
                    <option value="MANAGER">Manager</option>
                    <option value="EXECUTOR">Executor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No workspace members yet. You can add assignments later.
              </div>
            )}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((current) => Math.max(current - 1, 1))}
            disabled={step === 1 || isSubmitting}
          >
            Back
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={goNext}>
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create project"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
