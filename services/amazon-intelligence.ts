import type { IntelligenceSuggestion } from "@prisma/client";

import {
  getMockAmazonCampaigns,
  getMockAmazonListings,
  type AmazonListing,
} from "@/lib/mock-amazon-data";
import { prisma } from "@/lib/prisma";
import { createAlert } from "@/services/alert-service";

type AmazonTargets = {
  targetACOS?: number;
  targetROAS?: number;
  monthlyAdBudget?: number;
  campaignFocus?: "Launch" | "Growth" | "Efficiency";
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function calculateACOS(spend: number, sales: number) {
  return sales > 0 ? (spend / sales) * 100 : 999;
}

async function hasRecentDuplicate(projectId: string, type: string, keywordOrAsin: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const existing = await prisma.intelligenceSuggestion.findFirst({
    where: {
      projectId,
      type: type as never,
      createdAt: { gte: sevenDaysAgo },
      data: {
        path: ["dedupeKey"],
        equals: keywordOrAsin,
      },
    },
    select: { id: true },
  });

  return Boolean(existing);
}

export async function analyseAdPerformance(projectId: string): Promise<IntelligenceSuggestion[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { targets: true, workspaceId: true },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  const targets = (project.targets ?? {}) as AmazonTargets;
  const targetACOS = targets.targetACOS ?? 20;
  const targetROAS = targets.targetROAS ?? 4;
  const monthlyAdBudget = targets.monthlyAdBudget ?? 3000;
  const campaigns = getMockAmazonCampaigns();
  const created: IntelligenceSuggestion[] = [];

  for (const campaign of campaigns) {
    for (const keyword of campaign.keywords) {
      const actualACOS = calculateACOS(keyword.spend, keyword.sales);
      const dedupeKey = `${campaign.campaignId}:${keyword.keyword}`;

      if (
        actualACOS > targetACOS * 1.5 &&
        keyword.clicks > 10 &&
        keyword.sales < 2 &&
        !(await hasRecentDuplicate(projectId, "BID_ADJUST", dedupeKey))
      ) {
        const suggestedBid = roundMoney(keyword.bid * (targetACOS / actualACOS));
        created.push(
          await prisma.intelligenceSuggestion.create({
            data: {
              projectId,
              type: "BID_ADJUST",
              priority: "HIGH",
              title: `Reduce bid: "${keyword.keyword}"`,
              description: `Keyword ACOS is ${roundMoney(actualACOS)}%, well above the ${targetACOS}% target.`,
              data: {
                dedupeKey,
                keyword: keyword.keyword,
                campaignId: campaign.campaignId,
                currentValue: keyword.bid,
                suggestedValue: suggestedBid,
                expectedImpact: `Est. ACOS: ${roundMoney(actualACOS)}% -> ${targetACOS}%`,
              },
            },
          }),
        );
      }

      if (
        actualACOS < targetACOS * 0.6 &&
        keyword.clicks > 5 &&
        !(await hasRecentDuplicate(projectId, "BID_ADJUST", `${dedupeKey}:scale`))
      ) {
        const suggestedBid = roundMoney(Math.min(keyword.bid * 1.3, keyword.bid * 2));
        created.push(
          await prisma.intelligenceSuggestion.create({
            data: {
              projectId,
              type: "BID_ADJUST",
              priority: "MEDIUM",
              title: `Increase bid: "${keyword.keyword}"`,
              description: `Keyword ACOS is ${roundMoney(actualACOS)}%, below target. Increase bid to capture more volume.`,
              data: {
                dedupeKey: `${dedupeKey}:scale`,
                keyword: keyword.keyword,
                campaignId: campaign.campaignId,
                currentValue: keyword.bid,
                suggestedValue: suggestedBid,
                expectedImpact: `Increase visibility while ACOS remains below ${targetACOS}%`,
              },
            },
          }),
        );
      }

      if (
        keyword.clicks > 20 &&
        keyword.sales === 0 &&
        !(await hasRecentDuplicate(projectId, "NEGATIVE_KEYWORD", `${dedupeKey}:negative`))
      ) {
        created.push(
          await prisma.intelligenceSuggestion.create({
            data: {
              projectId,
              type: "NEGATIVE_KEYWORD",
              priority: "HIGH",
              title: `Add negative exact: "${keyword.keyword}"`,
              description: `This keyword has ${keyword.clicks} clicks and zero sales. Add it as an exact-match negative.`,
              data: {
                dedupeKey: `${dedupeKey}:negative`,
                keyword: keyword.keyword,
                matchType: "exact",
                estimatedWeeklyWaste: roundMoney(keyword.spend / 4),
                expectedImpact: `Save about $${roundMoney(keyword.spend / 4)} per week`,
              },
            },
          }),
        );
      }
    }
  }

  const totalSpend = campaigns.reduce((sum, campaign) => sum + campaign.spend, 0);
  const totalSales = campaigns.reduce((sum, campaign) => sum + campaign.sales, 0);
  const daysElapsed = new Date().getDate();
  const totalDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const projectedSpend = (totalSpend / daysElapsed) * totalDays;
  const monthlyROAS = totalSales / Math.max(totalSpend, 1);

  if (projectedSpend > monthlyAdBudget * 1.1) {
    created.push(
      await prisma.intelligenceSuggestion.create({
        data: {
          projectId,
          type: "BID_ADJUST",
          priority: "MEDIUM",
          title: "Reduce daily budget pacing",
          description: `Projected monthly spend is $${roundMoney(projectedSpend)}, above the $${monthlyAdBudget} budget.`,
          data: {
            dedupeKey: `budget:${new Date().toISOString().slice(0, 10)}`,
            currentValue: roundMoney(projectedSpend),
            suggestedValue: roundMoney(monthlyAdBudget / totalDays),
            expectedImpact: "Bring projected spend back inside monthly budget.",
          },
        },
      }),
    );
  }

  if (monthlyROAS < targetROAS) {
    created.push(
      await prisma.intelligenceSuggestion.create({
        data: {
          projectId,
          type: "LISTING_OPTIMIZATION",
          priority: "MEDIUM",
          title: "Improve listing conversion rate",
          description: `Monthly ROAS is ${roundMoney(monthlyROAS)}x, below the ${targetROAS}x target.`,
          data: {
            dedupeKey: `roas:${new Date().toISOString().slice(0, 10)}`,
            currentValue: roundMoney(monthlyROAS),
            suggestedValue: targetROAS,
            expectedImpact: "Improved conversion can raise ROAS without increasing bids.",
          },
        },
      }),
    );
  }

  const highPriorityCount = created.filter((suggestion) => suggestion.priority === "HIGH").length;
  if (highPriorityCount > 0) {
    await createAlert({
      workspaceId: project.workspaceId,
      projectId,
      severity: "WARNING",
      category: "AMAZON",
      title: `Amazon: ${highPriorityCount} high-priority suggestions need review`,
      message:
        "FlowIQ found Amazon advertising actions that may reduce wasted spend or improve campaign efficiency.",
      actionRequired:
        "Open the Amazon suggestions tab, review each high-priority bid or negative-keyword recommendation, then approve the actions that match your campaign strategy.",
    });
  }

  return created;
}

export async function analyseListingHealth(
  projectId: string,
  listings: AmazonListing[] = getMockAmazonListings(),
): Promise<IntelligenceSuggestion[]> {
  const created: IntelligenceSuggestion[] = [];

  for (const listing of listings) {
    const checks = [
      {
        failed: !listing.hasAPlus,
        title: `Add A+ content: ${listing.asin}`,
        description: "Listing is missing A+ content, which can improve conversion rate.",
      },
      {
        failed: listing.title.length < 150,
        title: `Expand title: ${listing.asin}`,
        description: "Title is under 150 characters. Add high-value descriptors and use cases.",
      },
      {
        failed: listing.bulletPoints.length < 5,
        title: `Add bullet points: ${listing.asin}`,
        description: "Listing has fewer than 5 bullet points. Add benefit-led bullets.",
      },
      {
        failed: listing.backendKeywords.length < 1000,
        title: `Expand backend keywords: ${listing.asin}`,
        description: "Backend keywords are below 1000 characters. Add relevant long-tail terms.",
      },
      {
        failed: listing.reviewRating < 4.0,
        title: `Review strategy needed: ${listing.asin}`,
        description: `Review rating is ${listing.reviewRating}. Improve review request and product feedback workflows.`,
      },
    ];

    for (const check of checks) {
      if (!check.failed) continue;

      created.push(
        await prisma.intelligenceSuggestion.create({
          data: {
            projectId,
            type: "LISTING_OPTIMIZATION",
            priority: listing.reviewRating < 4.0 ? "HIGH" : "MEDIUM",
            title: check.title,
            description: check.description,
            data: {
              dedupeKey: `${listing.asin}:${check.title}`,
              asin: listing.asin,
              currentValue: listing.title,
              expectedImpact: "Higher conversion rate can improve ROAS and organic ranking.",
            },
          },
        }),
      );
    }
  }

  return created;
}
