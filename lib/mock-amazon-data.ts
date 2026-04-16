export type AmazonKeywordPerformance = {
  keyword: string;
  bid: number;
  spend: number;
  sales: number;
  clicks: number;
};

export type AmazonCampaignPerformance = {
  campaignId: string;
  name: string;
  spend: number;
  sales: number;
  clicks: number;
  impressions: number;
  keywords: AmazonKeywordPerformance[];
};

export type AmazonListing = {
  asin: string;
  title: string;
  bulletPoints: string[];
  backendKeywords: string;
  hasAPlus: boolean;
  reviewCount: number;
  reviewRating: number;
  buyBoxOwnership: boolean;
};

export function getMockAmazonCampaigns(): AmazonCampaignPerformance[] {
  return [
    {
      campaignId: "cmp_launch_001",
      name: "Launch - Running Shoes",
      spend: 1280,
      sales: 3450,
      clicks: 820,
      impressions: 62400,
      keywords: [
        { keyword: "running shoes women", bid: 1.4, spend: 310, sales: 420, clicks: 164 },
        { keyword: "lightweight running shoes", bid: 1.1, spend: 180, sales: 760, clicks: 72 },
        { keyword: "cheap gym shoes", bid: 0.95, spend: 145, sales: 0, clicks: 41 },
        { keyword: "marathon training shoes", bid: 1.65, spend: 210, sales: 880, clicks: 69 },
      ],
    },
    {
      campaignId: "cmp_auto_002",
      name: "Auto - Discovery",
      spend: 940,
      sales: 1780,
      clicks: 690,
      impressions: 58100,
      keywords: [
        { keyword: "walking sneakers", bid: 0.82, spend: 120, sales: 140, clicks: 88 },
        { keyword: "orthopedic shoes women", bid: 1.2, spend: 260, sales: 180, clicks: 134 },
        { keyword: "fashion sneakers", bid: 0.7, spend: 95, sales: 0, clicks: 28 },
        { keyword: "trail running shoes", bid: 1.35, spend: 150, sales: 620, clicks: 51 },
      ],
    },
  ];
}

export function getMockAmazonListings(): AmazonListing[] {
  return [
    {
      asin: "B0FLOWIQ01",
      title: "Women Lightweight Running Shoes Breathable Gym Sneakers",
      bulletPoints: [
        "Breathable mesh upper",
        "Cushioned everyday sole",
        "Flexible grip outsole",
      ],
      backendKeywords: "running shoes gym sneakers lightweight breathable walking training",
      hasAPlus: false,
      reviewCount: 86,
      reviewRating: 3.8,
      buyBoxOwnership: true,
    },
    {
      asin: "B0FLOWIQ02",
      title:
        "Trail Running Shoes for Women Lightweight Outdoor Sneakers with Cushioned Sole and Durable Grip",
      bulletPoints: [
        "Outdoor-ready traction",
        "Supportive heel cup",
        "Lightweight foam midsole",
        "Breathable upper",
        "Everyday comfort fit",
      ],
      backendKeywords:
        "trail running shoes women outdoor sneakers grip lightweight hiking gym walking comfortable durable",
      hasAPlus: true,
      reviewCount: 214,
      reviewRating: 4.4,
      buyBoxOwnership: true,
    },
  ];
}
