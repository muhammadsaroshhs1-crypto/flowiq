import type { IntegrationType } from "@prisma/client";

export type IntegrationCategory = "SEO" | "CMS" | "MARKETPLACE" | "SOCIAL" | "ANALYTICS";
export type IntegrationAuthType = "oauth2" | "api_key";

export type IntegrationRegistryItem = {
  name: string;
  description: string;
  category: IntegrationCategory;
  icon: "search" | "globe" | "shopping-cart" | "bar-chart" | "users" | "link";
  authType: IntegrationAuthType;
  unlocks: string[];
  setupSteps: string[];
  credentialFields?: string[];
};

export const INTEGRATION_REGISTRY: Record<IntegrationType, IntegrationRegistryItem> = {
  GOOGLE_SEARCH_CONSOLE: {
    name: "Google Search Console",
    description: "Rankings, impressions, index coverage",
    category: "SEO",
    icon: "search",
    authType: "oauth2",
    unlocks: ["topical_authority", "rank_tracking", "index_monitoring"],
    setupSteps: ["Connect Google account", "Select property (site)", "Grant read access"],
    credentialFields: ["accessToken", "propertyUrl"],
  },
  WORDPRESS: {
    name: "WordPress",
    description: "Pages, posts, plugins, publish events",
    category: "CMS",
    icon: "globe",
    authType: "api_key",
    unlocks: ["social_sync", "content_briefs", "plugin_monitoring"],
    setupSteps: [
      "Install FlowIQ WordPress plugin OR generate Application Password",
      "Enter site URL + credentials",
    ],
    credentialFields: ["siteUrl", "username", "applicationPassword", "webhookSecret"],
  },
  AMAZON: {
    name: "Amazon Seller Central",
    description: "Listings, ads, inventory, orders",
    category: "MARKETPLACE",
    icon: "shopping-cart",
    authType: "api_key",
    unlocks: ["amazon_intelligence", "listing_monitoring", "bid_suggestions"],
    setupSteps: ["Add FlowIQ as a Selling Partner API app", "Enter Seller ID + MWS credentials"],
    credentialFields: ["sellerId", "marketplaceId", "refreshToken"],
  },
  GOOGLE_ANALYTICS: {
    name: "Google Analytics",
    description: "Traffic, conversion, and source reporting",
    category: "ANALYTICS",
    icon: "bar-chart",
    authType: "oauth2",
    unlocks: ["traffic_reporting", "conversion_monitoring"],
    setupSteps: ["Connect Google account", "Select GA4 property", "Grant read access"],
    credentialFields: ["accessToken", "propertyId"],
  },
  META: {
    name: "Meta",
    description: "Facebook and Instagram publishing",
    category: "SOCIAL",
    icon: "users",
    authType: "oauth2",
    unlocks: ["social_sync", "social_queue"],
    setupSteps: ["Connect Meta account", "Select pages", "Grant publishing permissions"],
    credentialFields: ["accessToken", "pageId"],
  },
  LINKEDIN: {
    name: "LinkedIn",
    description: "LinkedIn company page publishing",
    category: "SOCIAL",
    icon: "users",
    authType: "oauth2",
    unlocks: ["social_sync", "linkedin_posts"],
    setupSteps: ["Connect LinkedIn account", "Select organization", "Grant posting access"],
    credentialFields: ["accessToken", "organizationId"],
  },
  SHOPIFY: {
    name: "Shopify",
    description: "Products, pages, and store events",
    category: "CMS",
    icon: "shopping-cart",
    authType: "api_key",
    unlocks: ["website_monitoring", "product_content_sync"],
    setupSteps: ["Create private app", "Enter shop domain and token"],
    credentialFields: ["siteUrl", "shopDomain", "accessToken"],
  },
  WEBFLOW: {
    name: "Webflow",
    description: "Site pages and CMS collections",
    category: "CMS",
    icon: "globe",
    authType: "api_key",
    unlocks: ["website_monitoring", "content_briefs"],
    setupSteps: ["Create API token", "Enter site ID and site URL"],
    credentialFields: ["siteUrl", "siteId", "apiToken"],
  },
  AHREFS: {
    name: "Ahrefs",
    description: "Backlinks and keyword intelligence",
    category: "SEO",
    icon: "link",
    authType: "api_key",
    unlocks: ["backlink_monitoring", "keyword_gap_analysis"],
    setupSteps: ["Create API token", "Enter token in FlowIQ"],
    credentialFields: ["apiToken"],
  },
  SEMRUSH: {
    name: "Semrush",
    description: "Keyword and competitor research",
    category: "SEO",
    icon: "search",
    authType: "api_key",
    unlocks: ["keyword_gap_analysis", "rank_tracking"],
    setupSteps: ["Create API key", "Enter API key in FlowIQ"],
    credentialFields: ["apiKey"],
  },
  FLIPKART: {
    name: "Flipkart",
    description: "Marketplace listings and performance",
    category: "MARKETPLACE",
    icon: "shopping-cart",
    authType: "api_key",
    unlocks: ["marketplace_monitoring"],
    setupSteps: ["Create seller API credentials", "Enter seller ID and token"],
    credentialFields: ["sellerId", "apiToken"],
  },
  ETSY: {
    name: "Etsy",
    description: "Shop listings and order intelligence",
    category: "MARKETPLACE",
    icon: "shopping-cart",
    authType: "oauth2",
    unlocks: ["marketplace_monitoring"],
    setupSteps: ["Connect Etsy account", "Select shop", "Grant listing access"],
    credentialFields: ["accessToken", "shopId"],
  },
};

export const INTEGRATION_TYPES = Object.keys(INTEGRATION_REGISTRY) as IntegrationType[];
