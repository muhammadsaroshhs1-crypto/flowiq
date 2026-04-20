import {
  getMockAmazonCampaigns,
  getMockAmazonListings,
  type AmazonCampaignPerformance,
  type AmazonListing,
} from "@/lib/mock-amazon-data";

type AmazonTargets = {
  targetACOS?: number;
  targetROAS?: number;
  monthlyAdBudget?: number;
  campaignFocus?: "Launch" | "Growth" | "Efficiency";
};

export type AmazonBrandMetric = {
  label: string;
  value: string;
  helper: string;
  status: "good" | "warning" | "critical";
};

export type AmazonBrandAction = {
  lane: "Stop waste" | "Scale winners" | "Fix conversion" | "Defend rank";
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  reason: string;
  action: string;
  impact: string;
};

export type AmazonBrandProduct = {
  asin: string;
  title: string;
  readinessScore: number;
  rating: number;
  reviewCount: number;
  buyBoxOwnership: boolean;
  issues: string[];
};

export type AmazonBrandCommandCenter = {
  brandScore: number;
  mode: string;
  metrics: AmazonBrandMetric[];
  actions: AmazonBrandAction[];
  products: AmazonBrandProduct[];
  campaigns: Array<{
    id: string;
    name: string;
    spend: number;
    sales: number;
    acos: number;
    roas: number;
    clicks: number;
    verdict: string;
  }>;
  narrative: string;
};

function money(value: number) {
  return `$${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function pct(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

function acos(spend: number, sales: number) {
  return sales > 0 ? (spend / sales) * 100 : 999;
}

function roas(spend: number, sales: number) {
  return sales / Math.max(spend, 1);
}

function listingReadiness(listing: AmazonListing) {
  let score = 100;
  const issues: string[] = [];

  if (!listing.hasAPlus) {
    score -= 20;
    issues.push("Missing A+ content");
  }

  if (listing.title.length < 150) {
    score -= 15;
    issues.push("Title under 150 characters");
  }

  if (listing.bulletPoints.length < 5) {
    score -= 15;
    issues.push("Fewer than 5 bullet points");
  }

  if (listing.backendKeywords.length < 1000) {
    score -= 15;
    issues.push("Backend keywords under 1000 characters");
  }

  if (listing.reviewRating < 4) {
    score -= 20;
    issues.push("Review rating below 4.0");
  }

  if (!listing.buyBoxOwnership) {
    score -= 15;
    issues.push("Buy Box not owned");
  }

  return { score: Math.max(0, score), issues };
}

function campaignVerdict(campaign: AmazonCampaignPerformance, targetACOS: number) {
  const campaignAcos = acos(campaign.spend, campaign.sales);
  if (campaignAcos > targetACOS * 1.4) return "Bleeding spend";
  if (campaignAcos < targetACOS * 0.7) return "Scale candidate";
  return "Controlled";
}

export function getAmazonBrandCommandCenter(
  targets: AmazonTargets,
  campaigns = getMockAmazonCampaigns(),
  listings = getMockAmazonListings(),
): AmazonBrandCommandCenter {
  const targetACOS = targets.targetACOS ?? 20;
  const targetROAS = targets.targetROAS ?? 4;
  const monthlyAdBudget = targets.monthlyAdBudget ?? 3000;
  const campaignFocus = targets.campaignFocus ?? "Growth";

  const totalSpend = campaigns.reduce((sum, campaign) => sum + campaign.spend, 0);
  const totalSales = campaigns.reduce((sum, campaign) => sum + campaign.sales, 0);
  const totalClicks = campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0);
  const zeroSaleSpend = campaigns.reduce(
    (sum, campaign) =>
      sum + campaign.keywords.filter((keyword) => keyword.sales === 0 && keyword.clicks > 20).reduce((keywordSum, keyword) => keywordSum + keyword.spend, 0),
    0,
  );
  const blendedACOS = acos(totalSpend, totalSales);
  const blendedROAS = roas(totalSpend, totalSales);
  const listingScores = listings.map(listingReadiness);
  const listingReadinessScore = listingScores.length
    ? Math.round(listingScores.reduce((sum, item) => sum + item.score, 0) / listingScores.length)
    : 0;
  const buyBoxRiskCount = listings.filter((listing) => !listing.buyBoxOwnership).length;
  const spendPacing = monthlyAdBudget > 0 ? (totalSpend / monthlyAdBudget) * 100 : 0;

  const efficiencyScore = Math.max(0, Math.min(100, Math.round((targetACOS / Math.max(blendedACOS, 1)) * 70)));
  const wastePenalty = Math.min(25, Math.round((zeroSaleSpend / Math.max(totalSpend, 1)) * 100));
  const brandScore = Math.max(
    0,
    Math.min(100, Math.round((efficiencyScore + listingReadinessScore) / 2 - wastePenalty - buyBoxRiskCount * 5)),
  );

  const actions: AmazonBrandAction[] = [];
  for (const campaign of campaigns) {
    for (const keyword of campaign.keywords) {
      const keywordACOS = acos(keyword.spend, keyword.sales);
      if (keyword.clicks > 20 && keyword.sales === 0) {
        actions.push({
          lane: "Stop waste",
          priority: "HIGH",
          title: `Block wasted keyword: ${keyword.keyword}`,
          reason: `${keyword.clicks} clicks with zero sales.`,
          action: "Add this as an exact-match negative keyword and review the search term report for close variants.",
          impact: `Protect roughly ${money(keyword.spend / 4)} per week in wasted ad spend.`,
        });
      } else if (keywordACOS < targetACOS * 0.6 && keyword.clicks > 5) {
        actions.push({
          lane: "Scale winners",
          priority: "MEDIUM",
          title: `Scale profitable keyword: ${keyword.keyword}`,
          reason: `ACOS is ${pct(keywordACOS)}, safely below the ${targetACOS}% target.`,
          action: "Increase bid by 20-30%, move to exact match, and monitor placement performance for 72 hours.",
          impact: "Capture more profitable traffic while the keyword is still efficient.",
        });
      } else if (keywordACOS > targetACOS * 1.5 && keyword.clicks > 10) {
        actions.push({
          lane: "Stop waste",
          priority: "HIGH",
          title: `Reduce bid pressure: ${keyword.keyword}`,
          reason: `ACOS is ${pct(keywordACOS)}, above the target efficiency band.`,
          action: "Reduce bid using target ACOS math and test a tighter match type before pausing completely.",
          impact: "Lower wasted spend without killing all learning data.",
        });
      }
    }
  }

  listings.forEach((listing, index) => {
    const readiness = listingScores[index];
    if (readiness.score < 75) {
      actions.push({
        lane: "Fix conversion",
        priority: listing.reviewRating < 4 ? "HIGH" : "MEDIUM",
        title: `Improve retail readiness: ${listing.asin}`,
        reason: readiness.issues.join(", "),
        action: "Upgrade title, bullets, backend keywords, A+ content, and review strategy before scaling ads further.",
        impact: "Higher conversion rate improves ROAS, organic rank, and launch efficiency.",
      });
    }
  });

  if (!actions.length) {
    actions.push({
      lane: "Defend rank",
      priority: "LOW",
      title: "Brand is stable, protect the winners",
      reason: "No severe ad waste or listing health issue was detected in the current data.",
      action: "Keep weekly bid checks, review keyword harvests, and add backlinks/off-Amazon traffic to best sellers.",
      impact: "Protect organic rank and reduce dependence on paid discovery.",
    });
  }

  return {
    brandScore,
    mode: campaignFocus,
    metrics: [
      {
        label: "Brand score",
        value: `${brandScore}/100`,
        helper: "Combines ad efficiency, listing readiness, and waste risk.",
        status: brandScore >= 75 ? "good" : brandScore >= 55 ? "warning" : "critical",
      },
      {
        label: "Blended ACOS",
        value: pct(blendedACOS),
        helper: `Target is ${targetACOS}%.`,
        status: blendedACOS <= targetACOS ? "good" : blendedACOS <= targetACOS * 1.3 ? "warning" : "critical",
      },
      {
        label: "ROAS",
        value: `${Math.round(blendedROAS * 10) / 10}x`,
        helper: `Target is ${targetROAS}x.`,
        status: blendedROAS >= targetROAS ? "good" : blendedROAS >= targetROAS * 0.75 ? "warning" : "critical",
      },
      {
        label: "Waste detected",
        value: money(zeroSaleSpend),
        helper: `${totalClicks} ad clicks analysed.`,
        status: zeroSaleSpend === 0 ? "good" : zeroSaleSpend < totalSpend * 0.1 ? "warning" : "critical",
      },
      {
        label: "Listing readiness",
        value: `${listingReadinessScore}/100`,
        helper: "Title, bullets, A+, backend keywords, reviews, Buy Box.",
        status: listingReadinessScore >= 80 ? "good" : listingReadinessScore >= 60 ? "warning" : "critical",
      },
      {
        label: "Budget used",
        value: pct(spendPacing),
        helper: `${money(totalSpend)} spent from ${money(monthlyAdBudget)} budget.`,
        status: spendPacing <= 80 ? "good" : spendPacing <= 100 ? "warning" : "critical",
      },
    ],
    actions: actions.sort((a, b) => {
      const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return rank[a.priority] - rank[b.priority];
    }),
    products: listings.map((listing, index) => ({
      asin: listing.asin,
      title: listing.title,
      readinessScore: listingScores[index].score,
      rating: listing.reviewRating,
      reviewCount: listing.reviewCount,
      buyBoxOwnership: listing.buyBoxOwnership,
      issues: listingScores[index].issues,
    })),
    campaigns: campaigns.map((campaign) => ({
      id: campaign.campaignId,
      name: campaign.name,
      spend: campaign.spend,
      sales: campaign.sales,
      acos: Math.round(acos(campaign.spend, campaign.sales) * 10) / 10,
      roas: Math.round(roas(campaign.spend, campaign.sales) * 10) / 10,
      clicks: campaign.clicks,
      verdict: campaignVerdict(campaign, targetACOS),
    })),
    narrative:
      "FlowIQ reads the brand like an operator: stop wasted search terms first, scale efficient demand second, and only push budget harder when the listing can convert.",
  };
}

