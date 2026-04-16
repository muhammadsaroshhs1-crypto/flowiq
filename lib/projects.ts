import { Prisma, type Industry, type MemberRole, type ProjectStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ProjectAssignmentInput = {
  userId: string;
  role: Exclude<MemberRole, "OWNER">;
  assignedModules?: string[];
};

export type CreateProjectInput = {
  workspaceId: string;
  name: string;
  clientName?: string | null;
  industry: Industry;
  modules: string[];
  assignments: ProjectAssignmentInput[];
};

export async function getProjectsByWorkspace(workspaceId: string) {
  return prisma.project.findMany({
    where: {
      workspaceId,
      status: { not: "ARCHIVED" },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
      _count: {
        select: {
          members: true,
          pipelines: true,
          alerts: {
            where: {
              isResolved: false,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProjectById(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workspace: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
      alerts: {
        where: { isResolved: false },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      pipelines: {
        orderBy: { updatedAt: "desc" },
      },
      integrations: true,
      _count: {
        select: {
          members: true,
          pipelines: true,
          alerts: {
            where: {
              isResolved: false,
            },
          },
        },
      },
    },
  });
}

export async function createProject(data: CreateProjectInput) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        clientName: data.clientName,
        industry: data.industry,
        modules: data.modules,
        members: {
          create: data.assignments.map((assignment) => ({
            userId: assignment.userId,
            role: assignment.role,
            assignedModules: assignment.assignedModules ?? data.modules,
          })),
        },
      },
      include: {
        members: true,
      },
    });

    if (data.modules.includes("Website maintenance")) {
      await tx.pipeline.create({
        data: {
          projectId: project.id,
          name: "Website Maintenance - Monthly",
          description: "Recurring monthly maintenance workflow.",
          industry: "WEB_DESIGN",
          moduleType: "WEBSITE_MGMT",
          isRecurring: true,
          recurringCadence: "monthly",
          status: "ACTIVE",
        },
      });
    }

    return project;
  });
}

export async function updateProjectModules(projectId: string, modules: string[]) {
  return prisma.project.update({
    where: { id: projectId },
    data: { modules },
  });
}

export async function updateProject(
  projectId: string,
  data: {
    name?: string;
    clientName?: string | null;
    status?: ProjectStatus;
    modules?: string[];
    settings?: Prisma.InputJsonValue | null;
    targets?: Prisma.InputJsonValue | null;
  },
) {
  const updateData: Prisma.ProjectUpdateInput = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.clientName !== undefined) updateData.clientName = data.clientName;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.modules !== undefined) updateData.modules = data.modules;
  if (data.settings !== undefined) {
    updateData.settings = data.settings === null ? Prisma.DbNull : data.settings;
  }
  if (data.targets !== undefined) {
    updateData.targets = data.targets === null ? Prisma.DbNull : data.targets;
  }

  return prisma.project.update({
    where: { id: projectId },
    data: updateData,
  });
}
