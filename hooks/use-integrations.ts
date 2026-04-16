"use client";

import type { IntegrationType, ProjectIntegration } from "@prisma/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function useIntegrations(projectId: string) {
  const [integrations, setIntegrations] = useState<ProjectIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/integrations`);
      const data = (await response.json()) as {
        integrations?: ProjectIntegration[];
        error?: string;
      };

      if (!response.ok || data.error) {
        toast.error(data.error ?? "Could not load integrations");
        return;
      }

      setIntegrations(data.integrations ?? []);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [projectId]);

  function isConnected(type: IntegrationType): boolean {
    return Boolean(integrations.find((integration) => integration.type === type && integration.isConnected));
  }

  function getIntegration(type: IntegrationType): ProjectIntegration | null {
    return integrations.find((integration) => integration.type === type) ?? null;
  }

  return { integrations, isLoading, isConnected, getIntegration, refresh };
}
