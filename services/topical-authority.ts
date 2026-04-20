import type { TopicMap } from "@prisma/client";
import OpenAI from "openai";

import { prisma } from "@/lib/prisma";

export type ExistingPage = {
  url: string;
  title: string;
  content?: string;
};

export type TopicMapInput = {
  projectId: string;
  niche: string;
  targetAudience: string;
  existingPages: ExistingPage[];
};

export type ContentBriefInput = {
  topic: string;
  targetKeyword: string;
  niche: string;
  existingTopicUrls: string[];
};

type PillarTopic = {
  topic: string;
  targetKeyword: string;
  searchIntent: string;
  priority: "high" | "medium" | "low";
  exists: boolean;
  existingUrl?: string;
};

type ClusterTopic = {
  pillar: string;
  topic: string;
  targetKeyword: string;
  wordCount: number;
  priority: "high" | "medium" | "low";
  status: "existing" | "gap" | "in_progress";
  existingUrl?: string;
};

type TopicMapResponse = {
  pillarTopics: PillarTopic[];
  clusterTopics: ClusterTopic[];
};

export const TOPIC_MAP_SYSTEM_PROMPT =
  "You are an expert SEO strategist. Given a niche, target audience, and list of existing pages, generate a complete topical authority map. Return ONLY valid JSON in this exact structure:\n{\n  pillarTopics: [{ topic: string, targetKeyword: string, searchIntent: string, priority: 'high'|'medium'|'low', exists: boolean, existingUrl?: string }],\n  clusterTopics: [{ pillar: string, topic: string, targetKeyword: string, wordCount: number, priority: 'high'|'medium'|'low', status: 'existing'|'gap'|'in_progress', existingUrl?: string }]\n}";

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function parseTopicMapResponse(raw: string): TopicMapResponse {
  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  const parsed = JSON.parse(trimmed) as TopicMapResponse;

  if (!Array.isArray(parsed.pillarTopics) || !Array.isArray(parsed.clusterTopics)) {
    throw new Error("OpenAI response did not include topic arrays.");
  }

  return parsed;
}

function calculateCoverageScore(map: TopicMapResponse) {
  const totalTopics = map.pillarTopics.length + map.clusterTopics.length;
  const existingTopics =
    map.pillarTopics.filter((topic) => topic.exists).length +
    map.clusterTopics.filter((topic) => topic.status === "existing").length;

  return totalTopics ? Math.round((existingTopics / totalTopics) * 100) : 0;
}

function humanizeSlug(value: string) {
  return value
    .replace(/^https?:\/\//, "")
    .replace(/[#?].*$/, "")
    .split("/")
    .filter(Boolean)
    .slice(-1)[0]
    ?.replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || value;
}

function topicExists(topic: string, pages: ExistingPage[]) {
  const normalizedTopic = topic.toLowerCase();
  return pages.find((page) => {
    const haystack = `${page.url} ${page.title} ${page.content ?? ""}`.toLowerCase();
    return normalizedTopic
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .some((word) => haystack.includes(word));
  });
}

function buildFallbackTopicMap(input: TopicMapInput): TopicMapResponse {
  const niche = input.niche.trim();
  const audience = input.targetAudience.trim();
  const existingPageTopics = input.existingPages.slice(0, 4).map((page) => humanizeSlug(page.title || page.url));
  const lowerNiche = niche.toLowerCase();
  const isLocal = /\b(boston|karachi|london|new york|dubai|near me|local)\b/i.test(niche);
  const isAgency = /\b(agency|marketing|seo|web design|design|development)\b/i.test(niche);
  const isEcommerce = /\b(shopify|ecommerce|amazon|store|product)\b/i.test(niche);

  const basePillars = [
    `${niche} services`,
    `${niche} pricing and packages`,
    `${niche} case studies`,
    `${niche} strategy for ${audience}`,
  ];

  if (isLocal) basePillars.push(`${niche} local market guide`);
  if (isAgency) basePillars.push(`${niche} process and deliverables`);
  if (isEcommerce) basePillars.push(`${niche} growth and conversion optimization`);
  basePillars.push(...existingPageTopics);

  const uniquePillars = Array.from(new Set(basePillars)).slice(0, 6);
  const pillarTopics = uniquePillars.map<PillarTopic>((topic, index) => {
    const existingPage = topicExists(topic, input.existingPages);
    return {
      topic,
      targetKeyword: topic.toLowerCase(),
      searchIntent: index === 1 ? "Commercial investigation" : index === 2 ? "Trust and proof" : "Informational and commercial",
      priority: index < 3 ? "high" : index < 5 ? "medium" : "low",
      exists: Boolean(existingPage),
      existingUrl: existingPage?.url,
    };
  });

  const clusterSeeds: Array<[string, string, number]> = [
    ["How to choose", `How to choose a ${niche} provider`, 1400],
    ["Cost", `${niche} cost breakdown`, 1200],
    ["Checklist", `${niche} checklist for ${audience}`, 1300],
    ["Mistakes", `${niche} mistakes to avoid`, 1200],
    ["Comparison", `${niche} vs alternatives`, 1500],
    ["Timeline", `${niche} timeline and process`, 1100],
    ["Examples", `${niche} examples and case studies`, 1400],
    ["Questions", `${niche} FAQs`, 900],
  ];

  const clusterTopics = uniquePillars.flatMap((pillar, pillarIndex) =>
    clusterSeeds.slice(0, pillarIndex < 3 ? 4 : 2).map<ClusterTopic>(([, topic, wordCount], index) => {
      const existingPage = topicExists(topic, input.existingPages);
      return {
        pillar,
        topic,
        targetKeyword: topic.toLowerCase(),
        wordCount,
        priority: pillarIndex < 2 && index < 2 ? "high" : index < 3 ? "medium" : "low",
        status: existingPage ? "existing" : "gap",
        existingUrl: existingPage?.url,
      };
    }),
  );

  return { pillarTopics, clusterTopics };
}

function isOpenAIQuotaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: number; code?: string; message?: string };
  return candidate.status === 429 || candidate.code === "insufficient_quota" || candidate.message?.includes("quota");
}

async function saveTopicMap(input: TopicMapInput, parsed: TopicMapResponse, metadata: Record<string, unknown>) {
  const coverageScore = calculateCoverageScore(parsed);

  return prisma.topicMap.create({
    data: {
      projectId: input.projectId,
      niche: input.niche,
      pillarTopics: parsed.pillarTopics,
      clusterTopics: parsed.clusterTopics,
      coverageScore,
      lastGeneratedAt: new Date(),
      metadata: {
        ...metadata,
        targetAudience: input.targetAudience,
        existingPageCount: input.existingPages.length,
      },
    },
  });
}

export async function generateTopicMap(input: TopicMapInput): Promise<TopicMap> {
  const latestMap = await prisma.topicMap.findFirst({
    where: { projectId: input.projectId },
    orderBy: { lastGeneratedAt: "desc" },
  });

  if (latestMap) {
    const nextAllowedAt = latestMap.lastGeneratedAt.getTime() + 60 * 60 * 1000;
    if (Date.now() < nextAllowedAt) {
      throw new Error("Topic map generation is limited to once per project per hour.");
    }
  }

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: TOPIC_MAP_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            niche: input.niche,
            targetAudience: input.targetAudience,
            existingPages: input.existingPages,
          }),
        },
      ],
    });

    const rawResponse = response.choices[0]?.message.content;
    if (!rawResponse) {
      throw new Error("OpenAI returned an empty topic map response.");
    }

    const parsed = parseTopicMapResponse(rawResponse);
    return saveTopicMap(input, parsed, {
      generationMode: "openai",
      rawOpenAIResponse: rawResponse,
    });
  } catch (error) {
    console.error("Failed to generate topic map.", error);
    const fallback = buildFallbackTopicMap(input);
    return saveTopicMap(input, fallback, {
      generationMode: "fallback",
      fallbackReason: isOpenAIQuotaError(error)
        ? "OpenAI quota was unavailable, so FlowIQ generated a rules-based topical map."
        : "OpenAI generation failed, so FlowIQ generated a rules-based topical map.",
    });
  }
}

export async function generateContentBrief(input: ContentBriefInput): Promise<string> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are an expert SEO content strategist. Return a practical markdown content brief with these sections: Target keyword, Secondary keywords, Search intent, Recommended word count, Suggested H2 structure, Internal link suggestions, Competitor angle, Meta title suggestions, Meta description suggestions.",
        },
        {
          role: "user",
          content: JSON.stringify({
            topic: input.topic,
            targetKeyword: input.targetKeyword,
            niche: input.niche,
            existingTopicUrls: input.existingTopicUrls,
            requirements: {
              secondaryKeywords: 5,
              h2Headings: 6,
            },
          }),
        },
      ],
    });

    const brief = response.choices[0]?.message.content;
    if (!brief) {
      throw new Error("OpenAI returned an empty content brief.");
    }

    return brief;
  } catch (error) {
    console.error("Failed to generate content brief.", error);
    return [
      `# Content Brief: ${input.topic}`,
      "",
      `## Target Keyword`,
      input.targetKeyword,
      "",
      "## Secondary Keywords",
      `- ${input.targetKeyword} guide`,
      `- best ${input.targetKeyword}`,
      `- ${input.targetKeyword} cost`,
      `- ${input.targetKeyword} checklist`,
      `- ${input.targetKeyword} examples`,
      "",
      "## Search Intent",
      "The reader wants a practical explanation, clear options, and enough proof to decide the next step.",
      "",
      "## Recommended Word Count",
      "1,200-1,800 words, depending on competition and current ranking pages.",
      "",
      "## Suggested H2 Structure",
      `- What is ${input.topic}?`,
      `- Who needs ${input.topic}?`,
      "- Main benefits and business impact",
      "- Step-by-step process or checklist",
      "- Cost, timeline, or comparison section",
      "- FAQs and next action",
      "",
      "## Internal Link Suggestions",
      ...(input.existingTopicUrls.length
        ? input.existingTopicUrls.map((url) => `- Link to ${url}`)
        : ["- Link to the main service page", "- Link to one relevant case study", "- Link to the contact or consultation page"]),
      "",
      "## Competitor Angle",
      "Make the page more useful than generic competitor content by adding examples, local context, a checklist, proof, and a clear next step.",
      "",
      "## Meta Title Suggestions",
      `- ${input.topic}: Complete Guide`,
      `- ${input.targetKeyword}: Strategy, Cost, and Checklist`,
      "",
      "## Meta Description Suggestions",
      `- Learn how ${input.topic.toLowerCase()} works, what to prioritize, and how to turn it into measurable business results.`,
      "",
      "> FlowIQ generated this fallback brief because the AI quota was unavailable. Add OpenAI billing/quota for richer AI-written briefs.",
    ].join("\n");
  }
}
