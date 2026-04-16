"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StageStatus, TaskStatus } from "@prisma/client";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ExecutionTask = {
  id: string;
  title: string;
  status: TaskStatus;
  notes: string | null;
  assignedMemberId: string | null;
};

type ExecutionStage = {
  id: string;
  name: string;
  status: StageStatus;
  dueDate: Date | null;
  assignedMemberId: string | null;
  tasks: ExecutionTask[];
};

type ExecutionPipeline = {
  id: string;
  name: string;
  dueDate: Date | null;
  stages: ExecutionStage[];
};

function getProgress(stages: ExecutionStage[]) {
  const tasks = stages.flatMap((stage) => stage.tasks);
  const completedTasks = tasks.filter((task) => task.status === "DONE" || task.status === "SKIPPED").length;
  return {
    completedTasks,
    totalTasks: tasks.length,
    percent: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
  };
}

export function PipelineExecutionView({ pipeline }: { pipeline: ExecutionPipeline }) {
  const router = useRouter();
  const [openStages, setOpenStages] = useState<Record<string, boolean>>(
    Object.fromEntries(pipeline.stages.map((stage, index) => [stage.id, index === 0])),
  );
  const progress = getProgress(pipeline.stages);

  async function updateTask(taskId: string, status: TaskStatus, notes?: string | null) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-background p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Pipeline execution</p>
            <h1 className="text-2xl font-semibold tracking-tight">{pipeline.name}</h1>
          </div>
          <Badge variant="outline">
            {progress.completedTasks}/{progress.totalTasks} tasks done
          </Badge>
        </div>
        <Progress value={progress.percent} className="mt-4" />
      </div>

      <div className="space-y-3">
        {pipeline.stages.map((stage) => {
          const isOpen = openStages[stage.id];
          const stageDone = stage.tasks.filter((task) => task.status === "DONE" || task.status === "SKIPPED").length;

          return (
            <div key={stage.id} className="rounded-lg border bg-background">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 p-4 text-left"
                onClick={() =>
                  setOpenStages((current) => ({
                    ...current,
                    [stage.id]: !current[stage.id],
                  }))
                }
              >
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <div>
                    <p className="font-medium">{stage.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {stageDone}/{stage.tasks.length} tasks complete
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{stage.status}</Badge>
              </button>

              {isOpen ? (
                <div className="space-y-3 border-t p-4">
                  {stage.tasks.map((task) => (
                    <div key={task.id} className="rounded-md border p-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={task.status === "DONE"}
                          onChange={(event) =>
                            updateTask(task.id, event.target.checked ? "DONE" : "PENDING", task.notes)
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={cn("text-sm font-medium", task.status === "DONE" && "line-through text-muted-foreground")}>
                              {task.title}
                            </p>
                            <Badge variant="outline">{task.status}</Badge>
                          </div>
                          <Textarea
                            className="mt-3 min-h-20"
                            defaultValue={task.notes ?? ""}
                            placeholder="Add notes for this task"
                            onBlur={(event) => updateTask(task.id, task.status, event.target.value || null)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
