import type { SocialPlatform, SocialQueueItem } from "@prisma/client";
import OpenAI from "openai";

import { prisma } from "@/lib/prisma";
import { createAlert } from "@/services/alert-service";

export type PublishedContent = {
  title: string;
  url: string;
  excerpt: string;
  categories: string[];
};

export const SOCIAL_PROMPTS: Record<SocialPlatform, string> = {
  LINKEDIN:
    "You are a professional LinkedIn content writer. Write a LinkedIn post for this article. Rules: professional yet engaging tone, 150-200 words, start with a hook question or bold statement, 3 key insights from the article, clear CTA with the URL, 3-5 relevant hashtags. Do NOT use emojis.",
  INSTAGRAM:
    "You are an Instagram content strategist. Write an Instagram caption for this article. Rules: conversational and engaging tone, 100-150 words, start with an attention hook, value-focused content, CTA to visit link in bio, 15-20 highly relevant hashtags in a separate block. Use 2-3 relevant emojis naturally.",
  FACEBOOK:
    "You are a Facebook community manager. Write a Facebook post for this article. Rules: conversational, friendly tone, 100-150 words, ask a question to encourage comments, include the URL naturally in the text. 2-3 emojis max.",
  TWITTER:
    "You are a Twitter/X content writer. Write a thread of exactly 3 tweets for this article. Rules: Tweet 1 (hook, max 240 chars), Tweet 2 (key insight, max 240 chars), Tweet 3 (CTA + URL, max 240 chars). Separate each tweet with [TWEET]. No hashtags in tweets 1-2, max 2 hashtags in tweet 3.",
};

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function generateSocialPost(
  platform: SocialPlatform,
  content: PublishedContent,
): Promise<string> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.5,
      messages: [
        { role: "system", content: SOCIAL_PROMPTS[platform] },
        {
          role: "user",
          content: JSON.stringify({
            title: content.title,
            url: content.url,
            excerpt: content.excerpt,
            categories: content.categories,
          }),
        },
      ],
    });

    const draft = response.choices[0]?.message.content?.trim();

    if (!draft) {
      throw new Error("OpenAI returned an empty social draft.");
    }

    return draft;
  } catch (error) {
    console.error(`Failed to generate ${platform} social post.`, error);
    throw new Error(
      error instanceof Error ? error.message : `Could not generate ${platform} social post.`,
    );
  }
}

export async function createSocialQueueItems(
  projectId: string,
  content: PublishedContent,
): Promise<SocialQueueItem[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  const integrations = await prisma.projectIntegration.findMany({
    where: {
      projectId,
      isConnected: true,
      type: { in: ["LINKEDIN", "META"] },
    },
    select: { type: true },
  });

  const platforms = new Set<SocialPlatform>();
  for (const integration of integrations) {
    if (integration.type === "LINKEDIN") {
      platforms.add("LINKEDIN");
    }

    if (integration.type === "META") {
      platforms.add("INSTAGRAM");
      platforms.add("FACEBOOK");
    }
  }

  if (platforms.size === 0) {
    platforms.add("LINKEDIN");
    platforms.add("FACEBOOK");
    platforms.add("TWITTER");
  }

  const generatedItems = await Promise.all(
    Array.from(platforms).map(async (platform) => ({
      platform,
      draft: await generateSocialPost(platform, content),
    })),
  );

  const createdItems = await prisma.$transaction(async (tx) => {
    const items: SocialQueueItem[] = [];

    for (const item of generatedItems) {
      items.push(
        await tx.socialQueueItem.create({
          data: {
            projectId,
            sourceUrl: content.url,
            sourceTitle: content.title,
            platform: item.platform,
            draft: item.draft,
            status: "PENDING_REVIEW",
          },
        }),
      );
    }

    return items;
  });

  if (createdItems.length > 0) {
    await createAlert({
      workspaceId: project.workspaceId,
      projectId,
      severity: "INFO",
      category: "SOCIAL",
      title: "Social posts ready for review",
      message: `${createdItems.length} drafts generated from: ${content.title}`,
      actionRequired:
        "Review the generated drafts in the project social queue, approve the strongest version, then schedule it for publishing.",
      metadata: {
        sourceUrl: content.url,
        sourceTitle: content.title,
        generatedCount: createdItems.length,
      },
    });
  }

  return createdItems;
}
