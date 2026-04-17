"use client";

import type { IntegrationType, ProjectIntegration } from "@prisma/client";
import { BarChart3, Globe, LinkIcon, Search, ShoppingCart, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { IntegrationRegistryItem } from "@/lib/integrations";

const icons = {
  search: Search,
  globe: Globe,
  "shopping-cart": ShoppingCart,
  "bar-chart": BarChart3,
  users: Users,
  link: LinkIcon,
};

const supportCopy = {
  live_oauth: "Live OAuth",
  manual_validation: "Manual MVP",
  mock_validation: "Mock MVP",
};

export function IntegrationCard({
  projectId,
  type,
  registry,
  integration,
}: {
  projectId: string;
  type: IntegrationType;
  registry: IntegrationRegistryItem;
  integration?: ProjectIntegration | null;
}) {
  const Icon = icons[registry.icon];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isConnected = Boolean(integration?.isConnected);

  async function testConnection() {
    setIsTesting(true);

    try {
      const response = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, config }),
      });
      const data = (await response.json()) as { success: boolean; message: string };

      if (!data.success) {
        toast.error(data.message);
        return;
      }

      toast.success(data.message);
      setStep(4);
    } catch {
      toast.error("Connection test failed");
    } finally {
      setIsTesting(false);
    }
  }

  async function saveIntegration() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/integrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, config }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok || data.error) {
        toast.error(data.error ?? "Could not save integration");
        return;
      }

      toast.success("Integration connected");
      setOpen(false);
      window.location.reload();
    } catch {
      toast.error("Could not save integration");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="rounded-md border bg-muted p-2">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle>{registry.name}</CardTitle>
                <CardDescription>{registry.description}</CardDescription>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline">{registry.category}</Badge>
              <Badge variant={registry.supportLevel === "live_oauth" ? "default" : "outline"}>
                {supportCopy[registry.supportLevel]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {registry.unlocks.map((unlock) => (
              <Badge key={unlock} variant="outline">{unlock}</Badge>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <span className={isConnected ? "text-green-700" : "text-muted-foreground"}>
                {isConnected
                  ? `Connected${integration?.lastSyncedAt ? ` · Last synced ${new Date(integration.lastSyncedAt).toLocaleString()}` : ""}`
                  : "Not connected"}
              </span>
            </div>
            <Button variant={isConnected ? "outline" : "default"} onClick={() => setOpen(true)}>
              {isConnected ? "Manage" : "Connect"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{registry.name}</DialogTitle>
            <DialogDescription>Step {step} of 4</DialogDescription>
          </DialogHeader>

          {step === 1 ? (
            <div className="space-y-3">
              {registry.supportLevel !== "live_oauth" ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  This connector uses MVP validation right now. It can save configuration for testing, but full vendor OAuth/data sync is not production-ready yet.
                </div>
              ) : null}
              <ol className="space-y-3">
                {registry.setupSteps.map((item, index) => (
                  <li key={item} className="rounded-md border p-3 text-sm">
                    <span className="font-medium">Step {index + 1}: </span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {step === 2 ? (
            type === "GOOGLE_SEARCH_CONSOLE" ? (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  Connect your Google account and grant read-only Search Console access. FlowIQ will save the token encrypted.
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    window.location.href = `/api/integrations/google-search-console/start?projectId=${projectId}`;
                  }}
                >
                  Connect with Google
                </Button>
              </div>
            ) : registry.authType === "oauth2" ? (
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  OAuth redirects are placeholders in the MVP. Paste a token or account identifier below to continue testing.
                </p>
                <Input
                  className="mt-3"
                  placeholder="accessToken"
                  value={config.accessToken ?? ""}
                  onChange={(event) => setConfig((current) => ({ ...current, accessToken: event.target.value }))}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {(registry.credentialFields ?? ["apiKey"]).map((field) => (
                  <div key={field} className="space-y-1">
                    <label className="text-sm font-medium" htmlFor={`${type}-${field}`}>{field}</label>
                    <Input
                      id={`${type}-${field}`}
                      type={field.toLowerCase().includes("password") || field.toLowerCase().includes("token") || field.toLowerCase().includes("key") ? "password" : "text"}
                      value={config[field] ?? ""}
                      onChange={(event) => setConfig((current) => ({ ...current, [field]: event.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )
          ) : null}

          {step === 3 ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              Test the connection before saving. FlowIQ will store sensitive fields encrypted.
            </div>
          ) : null}

          {step === 4 ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              Connection test passed. Save this integration to unlock the related workflows.
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>
              Back
            </Button>
            {type === "GOOGLE_SEARCH_CONSOLE" && step === 2 ? null : step < 3 ? (
              <Button onClick={() => setStep((current) => current + 1)}>Continue</Button>
            ) : step === 3 ? (
              <Button onClick={testConnection} disabled={isTesting}>
                {isTesting ? "Testing..." : "Test connection"}
              </Button>
            ) : (
              <Button onClick={saveIntegration} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save integration"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
