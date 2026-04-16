import type { PipelineStatus, StageStatus, TaskStatus } from "@prisma/client";

import { PIPELINE_TEMPLATES } from "@/lib/pipeline-templates";
import { prisma } from "@/lib/prisma";

export async function createPipelineFromTemplate(
  projectId: string,
  templateName: string,
  options?: {
    name?: string;
    dueDate?: Date | null;
    assignedMemberId?: string | null;
  },
) {
  const template = PIPELINE_TEMPLATES.find((item) => item.name === templateName);

  if (!template) {
    throw new Error("Pipeline template not found.");
  }

  return prisma.pipeline.create({
    data: {
      projectId,
      name: options?.name || template.name,
      description: template.description,
      industry: template.industry,
      moduleType: template.moduleType,
      isRecurring: template.isRecurring ?? false,
      recurringCadence: template.recurringCadence,
      dueDate: options?.dueDate,
      stages: {
        create: template.stages.map((stage, stageIndex) => ({
          name: stage.name,
          description: stage.description,
          order: stageIndex + 1,
          assignedMemberId: options?.assignedMemberId,
          tasks: {
            create: stage.tasks.map((task, taskIndex) => ({
              title: task,
              order: taskIndex + 1,
              assignedMemberId: options?.assignedMemberId,
            })),
          },
        })),
      },
    },
    include: {
      stages: {
        include: { tasks: true },
        orderBy: { order: "asc" },
      },
    },
  });
}

export async function getPipelineProgress(pipelineId: string) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      stages: {
        include: { tasks: true },
      },
    },
  });

  if (!pipeline) {
    return { totalTasks: 0, completedTasks: 0, totalStages: 0, completedStages: 0, percentComplete: 0 };
  }

  const tasks = pipeline.stages.flatMap((stage) => stage.tasks);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "DONE" || task.status === "SKIPPED").length;
  const totalStages = pipeline.stages.length;
  const completedStages = pipeline.stages.filter((stage) => stage.status === "COMPLETED").length;
  const percentComplete = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return { totalTasks, completedTasks, totalStages, completedStages, percentComplete };
}

export async function getProjectPipelines(projectId: string) {
  const pipelines = await prisma.pipeline.findMany({
    where: { projectId },
    include: {
      stages: {
        include: { tasks: true },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return pipelines.map((pipeline) => {
    const totalStages = pipeline.stages.length;
    const completedStages = pipeline.stages.filter((stage) => stage.status === "COMPLETED").length;
    const tasks = pipeline.stages.flatMap((stage) => stage.tasks);
    const completedTasks = tasks.filter((task) => task.status === "DONE" || task.status === "SKIPPED").length;
    const percentComplete = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

    return {
      ...pipeline,
      progress: {
        totalTasks: tasks.length,
        completedTasks,
        totalStages,
        completedStages,
        percentComplete,
      },
    };
  });
}

export async function getPipelineForExecution(projectId: string, pipelineId: string) {
  return prisma.pipeline.findFirst({
    where: { id: pipelineId, projectId },
    include: {
      stages: {
        include: {
          tasks: {
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
      project: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function updateTaskAndCascade(
  taskId: string,
  data: {
    status?: TaskStatus;
    notes?: string | null;
    assignedMemberId?: string | null;
  },
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.update({
      where: { id: taskId },
      data: {
        status: data.status,
        notes: data.notes,
        assignedMemberId: data.assignedMemberId,
        completedAt: data.status === "DONE" ? new Date() : data.status ? null : undefined,
      },
      include: {
        stage: {
          include: {
            pipeline: {
              include: { stages: true },
            },
          },
        },
      },
    });

    const siblingTasks = await tx.task.findMany({
      where: { stageId: task.stageId },
      select: { status: true },
    });
    const stageComplete =
      siblingTasks.length > 0 &&
      siblingTasks.every((sibling) => sibling.status === "DONE" || sibling.status === "SKIPPED");

    if (stageComplete) {
      await tx.stage.update({
        where: { id: task.stageId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }

    const pipelineStages = await tx.stage.findMany({
      where: { pipelineId: task.stage.pipelineId },
      select: { status: true },
    });
    const pipelineComplete =
      pipelineStages.length > 0 &&
      pipelineStages.every((stage) => stage.status === "COMPLETED");

    if (pipelineComplete) {
      await tx.pipeline.update({
        where: { id: task.stage.pipelineId },
        data: { status: "COMPLETED" },
      });
    }

    return task;
  });
}

export async function autoCreateRecurringPipelines() {
  const completedRecurringPipelines = await prisma.pipeline.findMany({
    where: {
      isRecurring: true,
      status: "COMPLETED",
      recurringCadence: { not: null },
    },
    include: {
      stages: {
        include: { tasks: true },
        orderBy: { order: "asc" },
      },
    },
  });

  const created = [];

  for (const pipeline of completedRecurringPipelines) {
    const existingNext = await prisma.pipeline.findFirst({
      where: {
        projectId: pipeline.projectId,
        name: `${pipeline.name} (next cycle)`,
        status: { in: ["ACTIVE", "PAUSED"] },
      },
      select: { id: true },
    });

    if (existingNext) continue;

    created.push(
      await prisma.pipeline.create({
        data: {
          projectId: pipeline.projectId,
          name: `${pipeline.name} (next cycle)`,
          description: pipeline.description,
          industry: pipeline.industry,
          moduleType: pipeline.moduleType,
          isRecurring: true,
          recurringCadence: pipeline.recurringCadence,
          status: "ACTIVE",
          stages: {
            create: pipeline.stages.map((stage, stageIndex) => ({
              name: stage.name,
              description: stage.description,
              order: stageIndex + 1,
              tasks: {
                create: stage.tasks.map((task, taskIndex) => ({
                  title: task.title,
                  description: task.description,
                  isRequired: task.isRequired,
                  order: taskIndex + 1,
                })),
              },
            })),
          },
        },
      }),
    );
  }

  return created;
}

export type PipelineProgress = Awaited<ReturnType<typeof getPipelineProgress>>;
export type PipelineListStatus = PipelineStatus;
export type StageListStatus = StageStatus;
