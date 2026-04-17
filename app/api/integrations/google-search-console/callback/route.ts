import { auth } from "@clerk/nextjs/server";
import { IntegrationType } from "@prisma/client";
import { NextResponse } from "next/server";

import { encryptCredentials } from "@/lib/encryption";
import { getGoogleRedirectUri, parseGoogleOAuthState } from "@/lib/google-oauth";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type SearchConsoleSitesResponse = {
  siteEntry?: Array<{
    siteUrl: string;
    permissionLevel: string;
  }>;
};

function redirectToProject(requestUrl: string, projectId: string, status: "connected" | "error", reason?: string) {
  const url = new URL(`/projects/${projectId}/integrations`, requestUrl);
  url.searchParams.set("gsc", status);
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const requestUrl = request.url;
  const url = new URL(requestUrl);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  if (googleError) {
    return NextResponse.redirect(new URL(`/integrations?error=${googleError}`, requestUrl));
  }

  if (!code || !stateParam) {
    return Response.json({ error: "Missing Google OAuth code or state.", code: "GOOGLE_OAUTH_INVALID_CALLBACK" }, { status: 400 });
  }

  const state = parseGoogleOAuthState(stateParam);
  if (!state) {
    return Response.json({ error: "Invalid or expired Google OAuth state.", code: "GOOGLE_OAUTH_INVALID_STATE" }, { status: 400 });
  }

  const { userId } = await auth();
  if (!userId || userId !== state.clerkId) {
    return NextResponse.redirect(new URL("/sign-in", requestUrl));
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectToProject(requestUrl, state.projectId, "error", "google_oauth_env_missing");
  }

  const workspace = await getCurrentWorkspace(userId);
  if (!workspace) {
    return NextResponse.redirect(new URL("/onboarding", requestUrl));
  }

  const project = await prisma.project.findFirst({
    where: { id: state.projectId, workspaceId: workspace.id },
    select: { id: true },
  });

  if (!project) {
    return Response.json({ error: "Project not found.", code: "PROJECT_NOT_FOUND" }, { status: 404 });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getGoogleRedirectUri(url.origin),
    }),
  });

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error("Google OAuth token exchange failed.", tokenData.error, tokenData.error_description);
    return redirectToProject(requestUrl, state.projectId, "error", "token_exchange_failed");
  }

  const sitesResponse = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const sitesData = (await sitesResponse.json()) as SearchConsoleSitesResponse;

  if (!sitesResponse.ok) {
    console.error("Google Search Console site list failed.", sitesData);
    return redirectToProject(requestUrl, state.projectId, "error", "sites_fetch_failed");
  }

  const sites = sitesData.siteEntry ?? [];
  const selectedSite = sites[0]?.siteUrl ?? "";
  const expiresAt =
    typeof tokenData.expires_in === "number"
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

  await prisma.projectIntegration.upsert({
    where: {
      projectId_type: {
        projectId: state.projectId,
        type: IntegrationType.GOOGLE_SEARCH_CONSOLE,
      },
    },
    create: {
      projectId: state.projectId,
      type: IntegrationType.GOOGLE_SEARCH_CONSOLE,
      config: {
        propertyUrl: selectedSite,
        sites,
        encryptedCredentials: encryptCredentials({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt,
          scope: tokenData.scope,
          tokenType: tokenData.token_type,
        }),
      },
      isConnected: true,
      lastSyncedAt: new Date(),
    },
    update: {
      config: {
        propertyUrl: selectedSite,
        sites,
        encryptedCredentials: encryptCredentials({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt,
          scope: tokenData.scope,
          tokenType: tokenData.token_type,
        }),
      },
      isConnected: true,
      lastSyncedAt: new Date(),
    },
  });

  return redirectToProject(requestUrl, state.projectId, "connected");
}

