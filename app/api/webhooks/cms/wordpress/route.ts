/*
WordPress webhook setup:
- WordPress site must have a webhook plugin (WP Webhooks or similar)
- Configure it to POST to: https://yourapp.com/api/webhooks/cms/wordpress
- Include header: X-FlowIQ-Secret: [value from ProjectIntegration.config.webhookSecret]
- Trigger: post published
*/

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { createSocialQueueItems } from "@/services/social-sync";

const wordpressPayloadSchema = z.object({
  postId: z.union([z.string(), z.number()]),
  title: z.string().min(1),
  url: z.string().url(),
  excerpt: z.string().default(""),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  status: z.string(),
});

function getWebhookSecret(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null;
  }

  const secret = (config as { webhookSecret?: unknown }).webhookSecret;
  return typeof secret === "string" ? secret : null;
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-flowiq-secret");

  if (!secret) {
    return Response.json(
      { error: "Missing webhook secret.", code: "WEBHOOK_SECRET_MISSING" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const parsed = wordpressPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid WordPress webhook payload.", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    const integrations = await prisma.projectIntegration.findMany({
      where: {
        type: "WORDPRESS",
        isConnected: true,
      },
      select: {
        projectId: true,
        config: true,
      },
    });

    const integration = integrations.find(
      (item) => getWebhookSecret(item.config) === secret,
    );

    if (!integration) {
      return Response.json(
        { error: "Invalid webhook secret.", code: "INVALID_WEBHOOK_SECRET" },
        { status: 401 },
      );
    }

    if (parsed.data.status !== "publish") {
      return Response.json({ received: true, ignored: true });
    }

    void createSocialQueueItems(integration.projectId, {
      title: parsed.data.title,
      url: parsed.data.url,
      excerpt: parsed.data.excerpt,
      categories: parsed.data.categories,
    }).catch((error) => {
      console.error("Failed to process WordPress social sync webhook.", error);
    });

    return Response.json({ received: true });
  } catch (error) {
    console.error("Failed to process WordPress webhook.", error);
    return Response.json(
      { error: "Could not process webhook.", code: "WORDPRESS_WEBHOOK_FAILED" },
      { status: 500 },
    );
  }
}
