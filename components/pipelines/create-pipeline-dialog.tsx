"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PIPELINE_TEMPLATES } from "@/lib/pipeline-templates";
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

type ProjectMemberOption = {
  id: string;
  userId: string;
  user: {
    name: string | null;
    email: string;
  };
};

export function CreatePipelineDialog({
  projectId,
  members,
}: {
  projectId: string;
  members: ProjectMemberOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(PIPELINE_TEMPLATES[0]?.name ?? null);
  const [isCustom, setIsCustom] = useState(false);
  const [name, setName] = useState(PIPELINE_TEMPLATES[0]?.name ?? "");
  const [dueDate, setDueDate] = useState("");
  const [assignedMemberId, setAssignedMemberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const template = useMemo(
    () => PIPELINE_TEMPLATES.find((item) => item.name === selectedTemplate),
    [selectedTemplate],
  );

  function chooseTemplate(templateName: string) {
    setSelectedTemplate(templateName);
    setIsCustom(false);
    setName(templateName);
  }

  async function submit() {
    setError(null);

    if (!name.trim()) {
      setError("Pipeline name is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/pipelines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: selectedTemplate,
          isCustom,
          name,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          assignedMemberId: assignedMemberId || null,
        }),
      });

      const data = (await response.json()) as
        | { pipeline: { id: string } }
        | { error: string; code: string };

      if (!response.ok || "error" in data) {
        setError("error" in data ? data.error : "Could not create pipeline.");
        return;
      }

      setOpen(false);
      router.push(`/projects/${projectId}/pipelines/${data.pipeline.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong while creating the pipeline.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Add pipeline</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add pipeline</DialogTitle>
          <DialogDescription>
            Step {step} of 2: choose a template, then set ownership and timing.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
            {PIPELINE_TEMPLATES.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => chooseTemplate(item.name)}
                className={cn(
                  "rounded-lg border p-4 text-left transition hover:bg-muted",
                  selectedTemplate === item.name && !isCustom ? "border-primary bg-primary/5" : "",
                )}
              >
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {item.industry} · {item.moduleType}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setIsCustom(true);
                setSelectedTemplate(null);
                setName("Custom pipeline");
              }}
              className={cn(
                "rounded-lg border border-dashed p-4 text-left transition hover:bg-muted",
                isCustom ? "border-primary bg-primary/5" : "",
              )}
            >
              <p className="font-medium">Custom pipeline</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Start with a blank first stage and build your own workflow.
              </p>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              {isCustom
                ? "Custom pipeline with one empty first stage."
                : `${template?.stages.length ?? 0} stages and ${template?.stages.reduce((sum, stage) => sum + stage.tasks.length, 0) ?? 0} tasks will be created.`}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pipelineName">Pipeline name</Label>
              <Input id="pipelineName" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner">Overall owner</Label>
              <select
                id="owner"
                value={assignedMemberId}
                onChange={(event) => setAssignedMemberId(event.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.user.name ?? member.user.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting || step === 1} onClick={() => setStep(1)}>
            Back
          </Button>
          {step === 1 ? (
            <Button onClick={() => setStep(2)}>Continue</Button>
          ) : (
            <Button onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create pipeline"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
