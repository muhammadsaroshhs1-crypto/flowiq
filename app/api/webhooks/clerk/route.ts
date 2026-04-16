import { headers } from "next/headers";
import { Webhook } from "svix";

import { prisma } from "@/lib/prisma";

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkUserCreatedEvent = {
  type: "user.created";
  data: {
    id: string;
    email_addresses?: ClerkEmailAddress[];
    primary_email_address_id?: string;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
  };
};

type ClerkWebhookEvent = ClerkUserCreatedEvent | { type: string; data: unknown };

function getPrimaryEmail(event: ClerkUserCreatedEvent) {
  const emailAddresses = event.data.email_addresses ?? [];
  const primaryEmail = emailAddresses.find(
    (email) => email.id === event.data.primary_email_address_id,
  );

  return primaryEmail?.email_address ?? emailAddresses[0]?.email_address;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET is not configured.");
    return Response.json(
      { error: "Webhook secret is not configured.", code: "WEBHOOK_SECRET_MISSING" },
      { status: 500 },
    );
  }

  const payload = await request.text();
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json(
      { error: "Missing webhook signature headers.", code: "SIGNATURE_HEADERS_MISSING" },
      { status: 400 },
    );
  }

  let event: ClerkWebhookEvent;

  try {
    const webhook = new Webhook(webhookSecret);
    event = webhook.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (error) {
    console.error("Invalid Clerk webhook signature.", error);
    return Response.json(
      { error: "Invalid webhook signature.", code: "INVALID_SIGNATURE" },
      { status: 400 },
    );
  }

  if (event.type !== "user.created") {
    return Response.json({ received: true });
  }

  const userCreatedEvent = event as ClerkUserCreatedEvent;
  const email = getPrimaryEmail(userCreatedEvent);

  if (!email) {
    return Response.json(
      { error: "Clerk user is missing an email address.", code: "EMAIL_MISSING" },
      { status: 400 },
    );
  }

  const name = [userCreatedEvent.data.first_name, userCreatedEvent.data.last_name]
    .filter(Boolean)
    .join(" ");

  try {
    await prisma.user.upsert({
      where: { clerkId: userCreatedEvent.data.id },
      create: {
        clerkId: userCreatedEvent.data.id,
        email,
        name: name || null,
        avatarUrl: userCreatedEvent.data.image_url ?? null,
      },
      update: {
        email,
        name: name || null,
        avatarUrl: userCreatedEvent.data.image_url ?? null,
      },
    });

    return Response.json({ received: true });
  } catch (error) {
    console.error("Failed to persist Clerk user.", error);
    return Response.json(
      { error: "Could not sync user.", code: "USER_SYNC_FAILED" },
      { status: 500 },
    );
  }
}
