import type { Industry } from "@prisma/client";

export type PipelineTemplate = {
  name: string;
  description: string;
  industry: Industry;
  moduleType: string;
  isRecurring?: boolean;
  recurringCadence?: string;
  stages: Array<{
    name: string;
    description?: string;
    tasks: string[];
  }>;
};

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    name: "On-Page SEO Pipeline",
    description: "Audit, keyword mapping, optimization, publishing, and reporting.",
    industry: "SEO",
    moduleType: "ON_PAGE",
    stages: [
      {
        name: "Website audit",
        tasks: [
          "Content inventory",
          "Page speed check",
          "Title tag review",
          "Meta description audit",
          "Heading structure audit",
          "Image alt text check",
        ],
      },
      {
        name: "Keyword research",
        tasks: [
          "Seed keyword list",
          "Search volume analysis",
          "Keyword-to-page mapping",
          "Intent classification",
          "Competitor keyword gap",
        ],
      },
      {
        name: "Content optimisation",
        tasks: [
          "Title tag writing",
          "Meta description writing",
          "H1/H2 optimisation",
          "Internal linking plan",
          "Schema markup implementation",
          "Image compression",
        ],
      },
      {
        name: "Publishing checklist",
        tasks: [
          "Final page review",
          "GSC URL inspection",
          "Sitemap submission",
          "Rank tracking setup",
        ],
      },
      {
        name: "Monthly reporting",
        tasks: ["Ranking comparison", "Traffic delta", "On-page score update"],
      },
    ],
  },
  {
    name: "Off-Page SEO Pipeline",
    description: "Prospecting, outreach, link asset creation, and verification.",
    industry: "SEO",
    moduleType: "OFF_PAGE",
    stages: [
      { name: "Link prospecting", tasks: ["Define link criteria", "Build prospect list", "Qualify domains"] },
      { name: "Outreach", tasks: ["Write outreach templates", "Send first outreach", "Log responses"] },
      { name: "Content creation", tasks: ["Create guest post outline", "Draft link asset", "Submit for review"] },
      { name: "Live verification", tasks: ["Confirm live URL", "Check anchor text", "Record target page"] },
      { name: "Monthly link report", tasks: ["Summarize acquired links", "Check lost links", "Update authority metrics"] },
    ],
  },
  {
    name: "Technical SEO Pipeline",
    description: "Crawl health, performance, structured data, redirects, and monitoring.",
    industry: "SEO",
    moduleType: "TECHNICAL",
    stages: [
      { name: "Crawl & index audit", tasks: ["Run crawl", "Review indexability", "Check robots and sitemap"] },
      { name: "Core web vitals", tasks: ["Measure LCP", "Measure CLS", "Measure INP", "Document regressions"] },
      { name: "Structured data", tasks: ["Audit schema types", "Validate rich results", "Fix schema errors"] },
      { name: "Redirect & 404 management", tasks: ["Find 404s", "Map redirects", "Verify redirect chains"] },
      { name: "Ongoing monitoring", tasks: ["Set crawl schedule", "Configure alerts", "Review weekly issues"] },
    ],
  },
  {
    name: "Amazon Private Label Pipeline",
    description: "From product research through launch and ongoing optimization.",
    industry: "AMAZON",
    moduleType: "AMAZON_PL",
    stages: [
      { name: "Product research", tasks: ["Market scan", "Demand validation", "Margin estimate"] },
      { name: "Supplier sourcing", tasks: ["Shortlist suppliers", "Request quotes", "Negotiate MOQ"] },
      { name: "Sample & QC", tasks: ["Order samples", "Inspect quality", "Approve final sample"] },
      { name: "Listing creation", tasks: ["Write title", "Write bullets", "Prepare images", "Add backend keywords"] },
      { name: "Launch strategy", tasks: ["Set launch price", "Plan coupons", "Prepare review plan"] },
      { name: "PPC setup", tasks: ["Create auto campaign", "Create manual campaign", "Set initial bids"] },
      { name: "Ongoing optimisation", tasks: ["Review search terms", "Adjust bids", "Improve listing conversion"] },
    ],
  },
  {
    name: "Amazon Wholesale Pipeline",
    description: "Wholesale sourcing, eligibility, shipment, and monitoring.",
    industry: "AMAZON",
    moduleType: "AMAZON_WHOLESALE",
    stages: [
      { name: "Brand research", tasks: ["Identify brands", "Check Amazon presence", "Estimate demand"] },
      { name: "Supplier outreach", tasks: ["Find contact", "Send opening email", "Follow up"] },
      { name: "Price list analysis", tasks: ["Import price list", "Calculate ROI", "Flag profitable SKUs"] },
      { name: "Buy box eligibility", tasks: ["Check restrictions", "Verify FBA fees", "Confirm buy box history"] },
      { name: "FBA shipment", tasks: ["Create shipment plan", "Label units", "Send inventory"] },
      { name: "Monitoring", tasks: ["Track buy box", "Monitor stock", "Review repricing"] },
    ],
  },
  {
    name: "Website Build Pipeline",
    description: "Discovery, design, build, QA, launch, and handover.",
    industry: "WEB_DESIGN",
    moduleType: "WEBSITE_BUILD",
    stages: [
      { name: "Discovery", tasks: ["Collect requirements", "Map sitemap", "Confirm scope"] },
      { name: "Design", tasks: ["Wireframe pages", "Create visual direction", "Get approval"] },
      { name: "Development", tasks: ["Build templates", "Connect CMS", "Implement responsive states"] },
      { name: "QA", tasks: ["Browser testing", "Mobile testing", "Form testing", "Accessibility pass"] },
      { name: "Launch", tasks: ["DNS prep", "Deploy production", "Verify analytics"] },
      { name: "Handover", tasks: ["Record walkthrough", "Share credentials", "Document maintenance plan"] },
    ],
  },
  {
    name: "Website Maintenance - Monthly",
    description: "Recurring monthly care plan for website health.",
    industry: "WEB_DESIGN",
    moduleType: "WEBSITE_MGMT",
    isRecurring: true,
    recurringCadence: "monthly",
    stages: [
      { name: "Plugin & theme updates", tasks: ["Backup first", "Update plugins", "Update theme", "Check frontend"] },
      { name: "Security scan", tasks: ["Run malware scan", "Review login attempts", "Patch findings"] },
      { name: "Backup verification", tasks: ["Confirm latest backup", "Test restore point", "Log backup status"] },
      { name: "Performance check", tasks: ["Run speed test", "Compress new assets", "Review caching"] },
      { name: "Content updates", tasks: ["Apply requested edits", "Check formatting", "Publish updates"] },
      { name: "Client report", tasks: ["Summarize work", "List risks", "Send monthly report"] },
    ],
  },
];
