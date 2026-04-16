import axios from "axios";
import { z } from "zod";
import type { IntegrationType } from "@prisma/client";

import { INTEGRATION_TYPES } from "@/lib/integrations";

const testSchema = z.object({
  type: z.enum(INTEGRATION_TYPES as [IntegrationType, ...IntegrationType[]]),
  config: z.record(z.string(), z.unknown()),
});

function stringField(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, message: "Invalid integration test payload." }, { status: 400 });
  }

  const { type, config } = parsed.data;

  try {
    if (type === "WORDPRESS") {
      const siteUrl = stringField(config, "siteUrl").replace(/\/$/, "");
      const username = stringField(config, "username");
      const applicationPassword = stringField(config, "applicationPassword");

      if (!siteUrl) {
        return Response.json({ success: false, message: "Site URL is required." }, { status: 400 });
      }

      const response = await axios.get(`${siteUrl}/wp-json/wp/v2/posts?per_page=1`, {
        timeout: 10_000,
        auth: username && applicationPassword ? { username, password: applicationPassword } : undefined,
        validateStatus: () => true,
      });

      return Response.json({
        success: response.status >= 200 && response.status < 400,
        message: response.status >= 200 && response.status < 400 ? "WordPress connection works." : `WordPress returned ${response.status}.`,
        details: { status: response.status },
      });
    }

    if (type === "GOOGLE_SEARCH_CONSOLE" || type === "GOOGLE_ANALYTICS") {
      const token = stringField(config, "accessToken");
      if (!token) {
        return Response.json({ success: false, message: "Access token is required." }, { status: 400 });
      }

      const response = await axios.get("https://www.googleapis.com/oauth2/v1/tokeninfo", {
        params: { access_token: token },
        timeout: 10_000,
        validateStatus: () => true,
      });

      return Response.json({
        success: response.status >= 200 && response.status < 400,
        message: response.status >= 200 && response.status < 400 ? "Google token is valid." : "Google token could not be validated.",
        details: { status: response.status },
      });
    }

    if (type === "AMAZON") {
      const sellerId = stringField(config, "sellerId");
      const valid = /^[A-Z0-9]{8,20}$/.test(sellerId);
      return Response.json({
        success: valid,
        message: valid ? "Amazon seller ID format is valid for MVP." : "Amazon seller ID format looks invalid.",
      });
    }

    const siteUrl = stringField(config, "siteUrl") || stringField(config, "shopDomain");
    if (siteUrl) {
      const target = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
      const response = await axios.get(target, {
        timeout: 10_000,
        validateStatus: () => true,
      });

      return Response.json({
        success: response.status < 500,
        message: response.status < 500 ? "Endpoint is reachable." : `Endpoint returned ${response.status}.`,
        details: { status: response.status },
      });
    }

    return Response.json({
      success: true,
      message: "Basic MVP validation passed.",
    });
  } catch (error) {
    return Response.json({
      success: false,
      message: error instanceof Error ? error.message : "Connection test failed.",
    });
  }
}
