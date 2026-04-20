import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AmazonBrandCommandCenter } from "@/services/amazon-brand-intelligence";

const statusClasses = {
  good: "border-green-200 bg-green-50 text-green-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-red-200 bg-red-50 text-red-700",
};

const priorityClasses = {
  HIGH: "border-red-200 bg-red-50 text-red-700",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-700",
  LOW: "border-green-200 bg-green-50 text-green-700",
};

function money(value: number) {
  return `$${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function AmazonBrandCommandCenter({
  projectId,
  brandName,
  commandCenter,
  isAmazonConnected,
  sellerId,
}: {
  projectId: string;
  brandName: string;
  commandCenter: AmazonBrandCommandCenter;
  isAmazonConnected: boolean;
  sellerId?: string;
}) {
  return (
    <div className="space-y-5">
      <Card className="rounded-lg">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{brandName} Brand Command Center</CardTitle>
                <Badge className={commandCenter.brandScore >= 75 ? statusClasses.good : commandCenter.brandScore >= 55 ? statusClasses.warning : statusClasses.critical}>
                  {commandCenter.brandScore}/100
                </Badge>
                <Badge variant="outline">{commandCenter.mode} mode</Badge>
              </div>
              <CardDescription className="mt-2 max-w-3xl">
                {commandCenter.narrative}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={isAmazonConnected ? "default" : "outline"}>
                {isAmazonConnected ? "Amazon connected" : "Amazon sandbox not connected"}
              </Badge>
              {sellerId ? <Badge variant="outline">Seller {sellerId}</Badge> : null}
              <Link className={buttonVariants({ variant: "outline" })} href={`/projects/${projectId}/integrations`}>
                {isAmazonConnected ? "Manage integration" : "Connect Amazon"}
              </Link>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {commandCenter.metrics.map((metric) => (
          <Card key={metric.label} className="rounded-lg">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardDescription>{metric.label}</CardDescription>
                <Badge className={statusClasses[metric.status]}>
                  {metric.status === "good" ? "Good" : metric.status === "warning" ? "Watch" : "Critical"}
                </Badge>
              </div>
              <CardTitle className="text-2xl">{metric.value}</CardTitle>
              <CardDescription>{metric.helper}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Next best actions</CardTitle>
            <CardDescription>Operator-grade actions grouped by what protects or grows the brand first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {commandCenter.actions.slice(0, 6).map((action) => (
              <div key={`${action.lane}-${action.title}`} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{action.lane}</Badge>
                      <Badge className={priorityClasses[action.priority]}>{action.priority}</Badge>
                    </div>
                    <p className="mt-3 font-medium">{action.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{action.reason}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium">Action</p>
                    <p className="mt-1 text-sm text-muted-foreground">{action.action}</p>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-900">Expected impact</p>
                    <p className="mt-1 text-sm text-amber-900">{action.impact}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Campaign verdicts</CardTitle>
            <CardDescription>Each campaign gets a quick operator verdict.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {commandCenter.campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">{campaign.id}</p>
                  </div>
                  <Badge variant="outline">{campaign.verdict}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <span>Spend {money(campaign.spend)}</span>
                  <span>Sales {money(campaign.sales)}</span>
                  <span>ACOS {campaign.acos}%</span>
                  <span>ROAS {campaign.roas}x</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Listing readiness by product</CardTitle>
          <CardDescription>Ad spend should scale only when the retail page can convert.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {commandCenter.products.map((product) => (
            <div key={product.asin} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">{product.asin}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.title}</p>
                </div>
                <Badge className={product.readinessScore >= 80 ? statusClasses.good : product.readinessScore >= 60 ? statusClasses.warning : statusClasses.critical}>
                  {product.readinessScore}/100
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">{product.rating} stars</Badge>
                <Badge variant="outline">{product.reviewCount} reviews</Badge>
                <Badge variant={product.buyBoxOwnership ? "outline" : "destructive"}>
                  {product.buyBoxOwnership ? "Buy Box owned" : "Buy Box risk"}
                </Badge>
              </div>
              {product.issues.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.issues.map((issue) => (
                    <Badge key={issue} variant="outline">{issue}</Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

