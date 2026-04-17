import crypto from "node:crypto";

const STATE_SEPARATOR = ".";

export const GOOGLE_SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const GOOGLE_ANALYTICS_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
export const GOOGLE_OAUTH_SCOPES = `${GOOGLE_SEARCH_CONSOLE_SCOPE} ${GOOGLE_ANALYTICS_SCOPE}`;

function getSigningSecret() {
  const secret = process.env.INTEGRATION_SECRET;
  if (!secret) {
    throw new Error("INTEGRATION_SECRET is required for Google OAuth state signing.");
  }

  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export type GoogleOAuthState = {
  projectId: string;
  clerkId: string;
  createdAt: number;
};

export function createGoogleOAuthState(input: Omit<GoogleOAuthState, "createdAt">) {
  const payload = base64UrlEncode(JSON.stringify({ ...input, createdAt: Date.now() }));
  const signature = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}${STATE_SEPARATOR}${signature}`;
}

export function parseGoogleOAuthState(state: string): GoogleOAuthState | null {
  const [payload, signature] = state.split(STATE_SEPARATOR);
  if (!payload || !signature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("base64url");

  if (
    Buffer.byteLength(signature) !== Buffer.byteLength(expectedSignature) ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  const parsed = JSON.parse(base64UrlDecode(payload)) as GoogleOAuthState;
  const maxAgeMs = 10 * 60 * 1000;
  if (Date.now() - parsed.createdAt > maxAgeMs) {
    return null;
  }

  return parsed;
}

export function getGoogleRedirectUri(origin: string) {
  return `${origin}/api/integrations/google-search-console/callback`;
}
