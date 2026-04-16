"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function renderMarkdown(markdown: string) {
  return markdown.split("\n").map((line, index) => {
    if (line.startsWith("### ")) {
      return <h3 key={index} className="mt-5 text-base font-semibold">{line.replace("### ", "")}</h3>;
    }
    if (line.startsWith("## ")) {
      return <h2 key={index} className="mt-6 text-lg font-semibold">{line.replace("## ", "")}</h2>;
    }
    if (line.startsWith("# ")) {
      return <h1 key={index} className="mt-6 text-xl font-semibold">{line.replace("# ", "")}</h1>;
    }
    if (line.startsWith("- ")) {
      return <li key={index} className="ml-5 list-disc text-sm leading-6">{line.replace("- ", "")}</li>;
    }
    if (!line.trim()) {
      return <div key={index} className="h-2" />;
    }
    return <p key={index} className="text-sm leading-6 text-muted-foreground">{line}</p>;
  });
}

export function BriefPanel({
  projectId,
  topic,
  targetKeyword,
  brief,
  open,
  onOpenChange,
}: {
  projectId: string;
  topic: string;
  targetKeyword: string;
  brief: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);

  async function copyBrief() {
    await navigator.clipboard.writeText(brief);
    toast.success("Brief copied");
  }

  async function addToPipeline() {
    setIsAdding(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/intelligence/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_to_pipeline",
          topic,
          targetKeyword,
          brief,
        }),
      });

      const data = (await response.json()) as { task?: { id: string }; error?: string };

      if (!response.ok || data.error) {
        toast.error(data.error ?? "Could not add brief to pipeline");
        return;
      }

      toast.success("Task added to On-Page pipeline");
    } catch {
      toast.error("Could not add brief to pipeline");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{topic}</SheetTitle>
          <SheetDescription>Content brief for {targetKeyword}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">{renderMarkdown(brief)}</div>
        <SheetFooter>
          <Button variant="outline" onClick={copyBrief}>Copy brief</Button>
          <Button onClick={addToPipeline} disabled={isAdding}>
            {isAdding ? "Adding..." : "Add to On-Page pipeline"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
