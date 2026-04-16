import { auth, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const onboardingSchema = z.object({
  workspaceName: z.string().trim().min(2),
  userName: z.string().trim().min(1),
  primaryIndustry: z.enum(["SEO", "AMAZON", "WEB_DESIGN", "MULTI"]),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function createUniqueSlug(workspaceName: string) {
  const baseSlug = slugify(workspaceName) || "workspace";
  let slug = baseSlug;
  let suffix = 1;

  while (await prisma.workspace.findUnique({ where: { slug }, select: { id: true } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  return slug;
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: "You must be signed in.", code: "UNAUTHORIZED" },
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

  const parsed = onboardingSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid onboarding details.", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    const clerkUser = await currentUser();
    const email =
      clerkUser?.primaryEmailAddress?.emailAddress ??
      clerkUser?.emailAddresses[0]?.emailAddress;

    if (!email) {
      return Response.json(
        { error: "Your Clerk account is missing an email address.", code: "EMAIL_MISSING" },
        { status: 400 },
      );
    }

    const avatarUrl = clerkUser?.imageUrl ?? null;
    const slug = await createUniqueSlug(parsed.data.workspaceName);

    const result = await prisma.$transaction(async (tx) => {
      const appUser = await tx.user.upsert({
        where: { clerkId: userId },
        create: {
          clerkId: userId,
          email,
          name: parsed.data.userName,
          avatarUrl,
        },
        update: {
          email,
          name: parsed.data.userName,
          avatarUrl,
        },
      });

      const existingMembership = await tx.workspaceMember.findFirst({
        where: { userId: appUser.id },
        include: { workspace: true },
      });

      if (existingMembership) {
        return existingMembership.workspace;
      }

      const workspace = await tx.workspace.create({
        data: {
          name: parsed.data.workspaceName,
          slug,
          ownerId: userId,
          members: {
            create: {
              userId: appUser.id,
              role: "OWNER",
            },
          },
        },
      });

      return workspace;
    });

    return Response.json({ workspaceId: result.id, slug: result.slug });
  } catch (error) {
    console.error("Failed to create onboarding workspace.", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        { error: "A workspace with that slug already exists.", code: "SLUG_CONFLICT" },
        { status: 409 },
      );
    }

    return Response.json(
      { error: "Could not create workspace.", code: "WORKSPACE_CREATE_FAILED" },
      { status: 500 },
    );
  }
}
