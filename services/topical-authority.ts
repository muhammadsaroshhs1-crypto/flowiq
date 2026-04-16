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
          rawOpenAIResponse: rawResponse,
          targetAudience: input.targetAudience,
          existingPageCount: input.existingPages.length,
        },
      },
    });
  } catch (error) {
    console.error("Failed to generate topic map.", error);
    throw new Error(
      error instanceof Error ? error.message : "Could not generate topic map.",
    );
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
    throw new Error(
      error instanceof Error ? error.message : "Could not generate content brief.",
    );
  }
}
