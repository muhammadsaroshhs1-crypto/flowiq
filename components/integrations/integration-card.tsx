"use client";

import type { IntegrationType, ProjectIntegration } from "@prisma/client";
import { BarChart3, Globe, LinkIcon, Search, ShoppingCart, Users } from "lucide-react";
import { useRouter } from "next/navigation";
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

type IntegrationConfig = {
  propertyUrl?: string;
  ga4PropertyId?: string;
  ga4PropertyName?: string;
  sites?: Array<{
    siteUrl: string;
    permissionLevel: string;
  }>;
  analyticsProperties?: Array<{
    propertyId: string;
    displayName: string;
    accountName: string;
  }>;
};

function getIntegrationConfig(integration?: ProjectIntegration | null): IntegrationConfig {
  return integration?.config && typeof integration.config === "object" && !Array.isArray(integration.config)
    ? (integration.config as IntegrationConfig)
    : {};
}

function formatSyncDate(value: Date | string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function IntegrationCard({
  projectId,
  type,
  registry,
  integration,
  googleIntegration,
}: {
  projectId: string;
  type: IntegrationType;
  registry: IntegrationRegistryItem;
  integration?: ProjectIntegration | null;
  googleIntegration?: ProjectIntegration | null;
}) {
  const router = useRouter();
  const Icon = icons[registry.icon];
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [selectedPropertyUrl, setSelectedPropertyUrl] = useState("");
  const [selectedGa4PropertyId, setSelectedGa4PropertyId] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingProperty, setIsSavingProperty] = useState(false);
  const integrationConfig = getIntegrationConfig(integration);
  const googleConfig = getIntegrationConfig(googleIntegration);
  const gscSites = integrationConfig.sites ?? [];
  const selectedGscProperty = integrationConfig.propertyUrl ?? "";
  const analyticsProperties = integrationConfig.analyticsProperties ?? [];
  const selectedGa4Property = integrationConfig.ga4PropertyId ?? "";
  const analyticsPropertyName = googleConfig.ga4PropertyName || googleConfig.ga4PropertyId || "";
  const isAnalyticsCard = type === "GOOGLE_ANALYTICS";
  const isConnected = isAnalyticsCard ? Boolean(googleConfig.ga4PropertyId) : Boolean(integration?.isConnected);

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

  async function saveGoogleSearchConsoleProperty() {
    const propertyUrl = selectedPropertyUrl || selectedGscProperty;
    if (!propertyUrl) {
      toast.error("Choose a Search Console property first");
      return;
    }

    setIsSavingProperty(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/integrations/google-search-console/property`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyUrl,
          ga4PropertyId: selectedGa4PropertyId || selectedGa4Property || undefined,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok || data.error) {
        toast.error(data.error ?? "Could not save Search Console property");
        return;
      }

      toast.success("Search Console property connected");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Could not save Search Console property");
    } finally {
      setIsSavingProperty(false);
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
                {isAnalyticsCard
                  ? isConnected
                    ? "Connected through Google OAuth"
                    : "Choose GA4 in Google Search Console connector"
                  : isConnected
                  ? `Connected${formatSyncDate(integration?.lastSyncedAt) ? ` · Last synced ${formatSyncDate(integration?.lastSyncedAt)} UTC` : ""}`
                  : type === "GOOGLE_SEARCH_CONSOLE" && gscSites.length
                    ? "Google connected · choose property"
                  : "Not connected"}
              </span>
              {isAnalyticsCard && analyticsPropertyName ? (
                <p className="mt-1 text-xs text-muted-foreground">GA4 property {analyticsPropertyName}</p>
              ) : null}
              {type === "GOOGLE_SEARCH_CONSOLE" && selectedGscProperty ? (
                <p className="mt-1 break-all text-xs text-muted-foreground">{selectedGscProperty}</p>
              ) : null}
              {type === "GOOGLE_SEARCH_CONSOLE" && selectedGa4Property ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  GA4 property {integrationConfig.ga4PropertyName || selectedGa4Property}
                </p>
              ) : null}
            </div>
            <Button variant={isConnected ? "outline" : "default"} onClick={() => setOpen(true)}>
              {isAnalyticsCard ? "How to connect" : isConnected ? "Manage" : type === "GOOGLE_SEARCH_CONSOLE" && gscSites.length ? "Choose property" : "Connect"}
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
            isAnalyticsCard ? (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  GA4 uses the same Google OAuth connection as Search Console. Reconnect Google from the Google Search Console card, then choose the matching GA4 property there.
                </p>
                <p className="text-sm text-muted-foreground">
                  Current GA4 property: {analyticsPropertyName || "none selected"}
                </p>
              </div>
            ) : type === "GOOGLE_SEARCH_CONSOLE" ? (
              <div className="space-y-3 rounded-lg border p-4">
                {gscSites.length ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Choose which Google Search Console property belongs to this FlowIQ project.
                    </p>
                    <select
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value={selectedPropertyUrl || selectedGscProperty}
                      onChange={(event) => setSelectedPropertyUrl(event.target.value)}
                    >
                      <option value="">Select property</option>
                      {gscSites.map((site) => (
                        <option key={site.siteUrl} value={site.siteUrl}>
                          {site.siteUrl} · {site.permissionLevel}
                        </option>
                      ))}
                    </select>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">GA4 property for behavior data</label>
                      <select
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        value={selectedGa4PropertyId || selectedGa4Property}
                        onChange={(event) => setSelectedGa4PropertyId(event.target.value)}
                      >
                        <option value="">No GA4 property selected</option>
                        {analyticsProperties.map((property) => (
                          <option key={property.propertyId} value={property.propertyId}>
                            {property.displayName} · {property.accountName} · {property.propertyId}
                          </option>
                        ))}
                      </select>
                      {!analyticsProperties.length ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            No GA4 properties were returned automatically. Enable Google Analytics Admin API/Data API and reconnect Google, or paste the GA4 property ID below.
                          </p>
                          <Input
                            placeholder="Example: 123456789"
                            value={selectedGa4PropertyId}
                            onChange={(event) => setSelectedGa4PropertyId(event.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            You can find this in Google Analytics → Admin → Property details → Property ID.
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <Button type="button" onClick={saveGoogleSearchConsoleProperty} disabled={isSavingProperty}>
                      {isSavingProperty ? "Saving..." : "Save selected property"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        window.location.href = `/api/integrations/google-search-console/start?projectId=${projectId}`;
                      }}
                    >
                      Reconnect Google account
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Connect your Google account and grant read-only Search Console access. FlowIQ will then ask which property to use for this project.
                    </p>
                    <Button
                      type="button"
                      onClick={() => {
                        window.location.href = `/api/integrations/google-search-console/start?projectId=${projectId}`;
                      }}
                    >
                      Connect with Google
                    </Button>
                  </>
                )}
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
            {(type === "GOOGLE_SEARCH_CONSOLE" || isAnalyticsCard) && step === 2 ? null : step < 3 ? (
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
