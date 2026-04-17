import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  createGoogleOAuthState,
  getGoogleRedirectUri,
  GOOGLE_SEARCH_CONSOLE_SCOPE,
} from "@/lib/google-oauth";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/integrations?error=google_client_missing", request.url));
  }

  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) {
    return Response.json({ error: "projectId is required.", code: "PROJECT_ID_REQUIRED" }, { status: 400 });
  }

  const workspace = await getCurrentWorkspace(userId);
  if (!workspace) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });

  if (!project) {
    return Response.json({ error: "Project not found.", code: "PROJECT_NOT_FOUND" }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", getGoogleRedirectUri(origin));
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", GOOGLE_SEARCH_CONSOLE_SCOPE);
  authorizationUrl.searchParams.set("access_type", "offline");
  authorizationUrl.searchParams.set("prompt", "consent");
  authorizationUrl.searchParams.set("state", createGoogleOAuthState({ projectId, clerkId: userId }));

  return NextResponse.redirect(authorizationUrl);
}

