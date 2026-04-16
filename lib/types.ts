export type Plan = "SOLO" | "AGENCY" | "SCALE";

export type MemberRole = "OWNER" | "MANAGER" | "EXECUTOR" | "VIEWER";

export type Industry = "SEO" | "AMAZON" | "WEB_DESIGN" | "MULTI";

export type ProjectStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

export type PipelineStatus = "ACTIVE" | "PAUSED" | "COMPLETED";

export type StageStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "REVIEW"
  | "COMPLETED"
  | "BLOCKED";

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED";

export type AlertSeverity = "CRITICAL" | "WARNING" | "INFO";

export type AlertCategory =
  | "SEO"
  | "AMAZON"
  | "WEBSITE"
  | "SOCIAL"
  | "BILLING"
  | "SYSTEM";

export type IntegrationType =
  | "GOOGLE_SEARCH_CONSOLE"
  | "GOOGLE_ANALYTICS"
  | "WORDPRESS"
  | "SHOPIFY"
  | "WEBFLOW"
  | "AMAZON"
  | "FLIPKART"
  | "ETSY"
  | "META"
  | "LINKEDIN"
  | "AHREFS"
  | "SEMRUSH";

export type SocialPlatform = "LINKEDIN" | "INSTAGRAM" | "FACEBOOK" | "TWITTER";

export type SocialStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED"
  | "REJECTED";

export type SuggestionType =
  | "BID_ADJUST"
  | "NEGATIVE_KEYWORD"
  | "LISTING_OPTIMIZATION"
  | "CONTENT_BRIEF"
  | "BACKLINK_OPPORTUNITY"
  | "WEBSITE_FIX";

export type SuggestionPriority = "HIGH" | "MEDIUM" | "LOW";

export type SuggestionStatus = "PENDING" | "APPROVED" | "REJECTED" | "APPLIED";
