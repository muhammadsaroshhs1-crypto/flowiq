import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { SuggestionCard } from "@/components/amazon/suggestion-card";
import { TargetsForm } from "@/components/amazon/targets-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMockAmazonCampaigns, getMockAmazonListings } from "@/lib/mock-amazon-data";
import { prisma } from "@/lib/prisma";
import { getProjectById } from "@/lib/projects";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type AmazonTargets = {
  targetACOS?: number;
  targetROAS?: number;
  monthlyAdBudget?: number;
  campaignFocus?: "Launch" | "Growth" | "Efficiency";
};

type AmazonPageProps = {
  params: { projectId: string };
  searchParams?: {
    type?: string;
    priority?: string;
    status?: string;
  };
};

const suggestionTypes = ["ALL", "BID_ADJUST", "NEGATIVE_KEYWORD", "LISTING_OPTIMIZATION"] as const;
const priorities = ["ALL", "HIGH", "MEDIUM", "LOW"] as const;
const statuses = ["PENDING", "APPROVED", "REJECTED"] as const;

export default async function AmazonPage({ params, searchParams }: AmazonPageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [workspace, project] = await Promise.all([
    getCurrentWorkspace(userId),
    getProjectById(params.projectId),
  ]);

  if (!workspace) redirect("/onboarding");
  if (!project || project.workspaceId !== workspace.id) notFound();

  const typeFilter = suggestionTypes.includes(searchParams?.type as never)
    ? searchParams?.type
    : "ALL";
  const priorityFilter = priorities.includes(searchParams?.priority as never)
    ? searchParams?.priority
    : "ALL";
  const statusFilter = statuses.includes(searchParams?.status as never)
    ? searchParams?.status
    : "PENDING";

  const suggestions = await prisma.intelligenceSuggestion.findMany({
    where: {
      projectId: params.projectId,
      type: typeFilter === "ALL" ? undefined : (typeFilter as never),
      priority: priorityFilter === "ALL" ? undefined : (priorityFilter as never),
      status: statusFilter as never,
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  const targets = (project.targets ?? {}) as AmazonTargets;
  const listings = getMockAmazonListings();
  const campaigns = getMockAmazonCampaigns();
  const totalSpend = campaigns.reduce((sum, campaign) => sum + campaign.spend, 0);
  const totalSales = campaigns.reduce((sum, campaign) => sum + campaign.sales, 0);
  const totalClicks = campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0);
  const blendedAcos = totalSales ? Math.round((totalSpend / totalSales) * 1000) / 10 : 0;
  const averageRating =
    listings.length
      ? Math.round((listings.reduce((sum, listing) => sum + listing.reviewRating, 0) / listings.length) * 10) / 10
      : 0;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{project.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Amazon intelligence</h1>
      </div>

      <Tabs defaultValue="targets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="targets">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Advertising targets</CardTitle>
              <CardDescription>
                Save your ACOS, ROAS, budget, and campaign focus before running analysis.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TargetsForm projectId={params.projectId} initialTargets={targets} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Suggestion filters</CardTitle>
              <CardDescription>Review pending Amazon recommendations by type and priority.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-wrap gap-3">
                <select name="type" defaultValue={typeFilter} className="h-9 rounded-md border bg-background px-3 text-sm">
                  {suggestionTypes.map((type) => (
                    <option key={type} value={type}>{type === "ALL" ? "All types" : type}</option>
                  ))}
                </select>
                <select name="priority" defaultValue={priorityFilter} className="h-9 rounded-md border bg-background px-3 text-sm">
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>{priority === "ALL" ? "All priorities" : priority}</option>
                  ))}
                </select>
                <select name="status" defaultValue={statusFilter} className="h-9 rounded-md border bg-background px-3 text-sm">
                  {statuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <button className="h-9 rounded-md border px-3 text-sm" type="submit">Apply</button>
              </form>
            </CardContent>
          </Card>

          {suggestions.length ? (
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} projectId={params.projectId} />
              ))}
            </div>
          ) : (
            <Card className="rounded-lg border-dashed">
              <CardHeader>
                <CardTitle>No suggestions found</CardTitle>
                <CardDescription>
                  Run analysis from the Targets tab after connecting Amazon Seller Central.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="listings" className="space-y-3">
          {listings.map((listing) => (
            <Card key={listing.asin} className="rounded-lg">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>{listing.asin}</CardTitle>
                    <CardDescription>{listing.title}</CardDescription>
                  </div>
                  <Badge variant="outline">{listing.reviewRating} stars</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="outline">{listing.bulletPoints.length} bullets</Badge>
                <Badge variant="outline">{listing.hasAPlus ? "A+ content" : "No A+ content"}</Badge>
                <Badge variant="outline">{listing.buyBoxOwnership ? "Buy Box owned" : "Buy Box lost"}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-3">
          {campaigns.map((campaign) => {
            const acos = campaign.sales ? Math.round((campaign.spend / campaign.sales) * 1000) / 10 : 0;

            return (
              <Card key={campaign.campaignId} className="rounded-lg">
                <CardHeader>
                  <CardTitle>{campaign.name}</CardTitle>
                  <CardDescription>
                    Spend ${campaign.spend} · Sales ${campaign.sales} · ACOS {acos}%
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 md:grid-cols-4">
                  <Badge variant="outline">{campaign.clicks} clicks</Badge>
                  <Badge variant="outline">{campaign.impressions} impressions</Badge>
                  <Badge variant="outline">{campaign.keywords.length} keywords</Badge>
                  <Badge variant="outline">{campaign.campaignId}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>${totalSpend.toLocaleString()}</CardTitle>
                <CardDescription>Mock ad spend analysed</CardDescription>
              </CardHeader>
            </Card>
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>${totalSales.toLocaleString()}</CardTitle>
                <CardDescription>Mock attributed sales</CardDescription>
              </CardHeader>
            </Card>
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>{blendedAcos}%</CardTitle>
                <CardDescription>Blended ACOS</CardDescription>
              </CardHeader>
            </Card>
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>{averageRating}</CardTitle>
                <CardDescription>Average listing rating</CardDescription>
              </CardHeader>
            </Card>
          </div>
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>MVP report status</CardTitle>
              <CardDescription>
                This report currently uses the FlowIQ mock Amazon data generator. Connect Amazon SP-API in production to replace these numbers with live Seller Central and Ads data.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="outline">{campaigns.length} campaigns</Badge>
              <Badge variant="outline">{listings.length} listings</Badge>
              <Badge variant="outline">{totalClicks.toLocaleString()} clicks</Badge>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
