import type { Alert, AlertCategory, AlertSeverity } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AlertStats = {
  critical: number;
  warning: number;
  info: number;
  totalUnread: number;
};

export type CreateAlertInput = {
  workspaceId: string;
  projectId?: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  actionRequired?: string;
  metadata?: Record<string, unknown>;
};

type AlertClient = {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
};

const clients = new Map<string, Set<AlertClient>>();

function sendSse(client: AlertClient, event: string, data: unknown) {
  client.controller.enqueue(
    client.encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
  );
}

export function addAlertClient(workspaceId: string, client: AlertClient) {
  const workspaceClients = clients.get(workspaceId) ?? new Set<AlertClient>();
  workspaceClients.add(client);
  clients.set(workspaceId, workspaceClients);
}

export function removeAlertClient(workspaceId: string, client: AlertClient) {
  const workspaceClients = clients.get(workspaceId);
  if (!workspaceClients) return;

  workspaceClients.delete(client);
  if (workspaceClients.size === 0) {
    clients.delete(workspaceId);
  }
}

export function emitAlert(alert: Alert) {
  if (alert.severity === "INFO") return;

  const workspaceClients = clients.get(alert.workspaceId);
  if (!workspaceClients) return;

  workspaceClients.forEach((client) => {
    sendSse(client, "alert", alert);
  });
}

export async function createAlert(input: CreateAlertInput): Promise<Alert> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await prisma.alert.findFirst({
    where: {
      projectId: input.projectId ?? null,
      category: input.category,
      title: input.title,
      isResolved: false,
      createdAt: { gte: since },
    },
  });

  if (existing) {
    return existing;
  }

  const alert = await prisma.alert.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      severity: input.severity,
      category: input.category,
      title: input.title,
      message: input.message,
      actionRequired: input.actionRequired,
      metadata: input.metadata as never,
    },
  });

  await routeAlert(alert);
  return alert;
}

export async function routeAlert(alert: Alert): Promise<void> {
  if (alert.severity === "CRITICAL") {
    console.info("Notify OWNER + MANAGER by email placeholder and in-app.", alert.id);
  }

  if (alert.severity === "WARNING") {
    console.info("Notify OWNER + MANAGER + assigned EXECUTOR placeholder.", alert.id);
  }

  if (alert.severity === "INFO") {
    console.info("Batch INFO alert into daily digest placeholder.", alert.id);
  }

  emitAlert(alert);
}

export async function resolveAlert(alertId: string, _resolvedBy: string): Promise<Alert> {
  return prisma.alert.update({
    where: { id: alertId },
    data: {
      isResolved: true,
      resolvedAt: new Date(),
      isRead: true,
    },
  });
}

export async function getAlertStats(workspaceId: string): Promise<AlertStats> {
  const [critical, warning, info, totalUnread] = await Promise.all([
    prisma.alert.count({
      where: { workspaceId, severity: "CRITICAL", isResolved: false },
    }),
    prisma.alert.count({
      where: { workspaceId, severity: "WARNING", isResolved: false },
    }),
    prisma.alert.count({
      where: { workspaceId, severity: "INFO", isResolved: false },
    }),
    prisma.alert.count({
      where: { workspaceId, isRead: false, isResolved: false },
    }),
  ]);

  return { critical, warning, info, totalUnread };
}
