import tls from "node:tls";
import { URL } from "node:url";
import axios from "axios";
import { Prisma, type Alert, type AlertSeverity } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createAlert } from "@/services/alert-service";

export type UptimeResult = {
  isUp: boolean;
  responseTimeMs: number;
  statusCode: number;
  error?: string;
};

export type SSLResult = {
  daysUntilExpiry: number;
  expiresAt: Date;
  issuer: string;
};

export type CWVResult = {
  lcp: number;
  cls: number;
  inp: number;
  score: number;
  timestamp: Date;
};

export type BrokenLinkResult = {
  url: string;
  foundOn: string;
  statusCode: number;
};

export const MONITORING_ACTION_TEMPLATES = {
  SSL_EXPIRY:
    "Log into [hosting panel / Cloudflare] -> SSL/TLS -> Renew certificate. Takes 5-10 minutes. Do this before [expiryDate].",
  SITE_DOWN:
    "Check your hosting control panel for server errors. If using shared hosting, contact support. If self-managed: check nginx/apache logs at /var/log/nginx/error.log",
  LCP_REGRESSION:
    "LCP increased from [oldValue]s to [newValue]s since [date]. Most likely cause: a large image was added. Check your homepage images - compress any over 200KB using squoosh.app and convert to WebP.",
  PLUGIN_OUTDATED:
    "Update [plugin name] from version [old] to [new] via WordPress Admin -> Plugins -> Updates. Takes 1 minute. Backup first.",
  BROKEN_LINK:
    "[count] broken links found. Fix via your CMS: [page] -> [broken URL] -> update or redirect.",
};

export async function checkSiteUptime(url: string): Promise<UptimeResult> {
  const startedAt = Date.now();

  try {
    const response = await axios.get(url, {
      timeout: 10_000,
      validateStatus: () => true,
    });

    return {
      isUp: response.status >= 200 && response.status < 500,
      responseTimeMs: Date.now() - startedAt,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      isUp: false,
      responseTimeMs: Date.now() - startedAt,
      statusCode: 0,
      error: error instanceof Error ? error.message : "Unknown uptime error",
    };
  }
}

function firstCertificateValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export async function checkSSLExpiry(domain: string): Promise<SSLResult> {
  const hostname = domain.replace(/^https?:\/\//, "").split("/")[0];

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false,
      },
      () => {
        const certificate = socket.getPeerCertificate();
        socket.end();

        if (!certificate || !certificate.valid_to) {
          reject(new Error("No SSL certificate found."));
          return;
        }

        const expiresAt = new Date(certificate.valid_to);
        const daysUntilExpiry = Math.ceil(
          (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        const issuer =
          firstCertificateValue(certificate.issuer?.O) ??
          firstCertificateValue(certificate.issuer?.CN) ??
          "Unknown issuer";

        resolve({
          daysUntilExpiry,
          expiresAt,
          issuer,
        });
      },
    );

    socket.setTimeout(10_000, () => {
      socket.destroy();
      reject(new Error("SSL check timed out."));
    });

    socket.on("error", reject);
  });
}

export async function checkCoreWebVitals(url: string): Promise<CWVResult> {
  const response = await axios.get("https://www.googleapis.com/pagespeedonline/v5/runPagespeed", {
    params: {
      url,
      strategy: "mobile",
      ...(process.env.GOOGLE_PAGESPEED_API_KEY ? { key: process.env.GOOGLE_PAGESPEED_API_KEY } : {}),
    },
    timeout: 20_000,
  });

  const lighthouse = response.data?.lighthouseResult;
  const audits = lighthouse?.audits ?? {};

  return {
    lcp: Number(audits["largest-contentful-paint"]?.numericValue ?? 0) / 1000,
    cls: Number(audits["cumulative-layout-shift"]?.numericValue ?? 0),
    inp: Number(audits["interaction-to-next-paint"]?.numericValue ?? 0),
    score: Math.round(Number(lighthouse?.categories?.performance?.score ?? 0) * 100),
    timestamp: new Date(),
  };
}

function extractLinks(html: string, siteUrl: string) {
  const base = new URL(siteUrl);
  const matches = Array.from(html.matchAll(/<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["']/gi));
  const links = new Set<string>();

  for (const match of matches) {
    const href = match[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }

    try {
      const absolute = new URL(href, base);
      if (absolute.hostname === base.hostname) {
        links.add(absolute.toString());
      }
    } catch {
      continue;
    }

    if (links.size >= 50) break;
  }

  return Array.from(links);
}

export async function checkBrokenLinks(siteUrl: string): Promise<BrokenLinkResult[]> {
  const homepage = await axios.get(siteUrl, { timeout: 10_000 });
  const links = extractLinks(String(homepage.data), siteUrl);
  const results: BrokenLinkResult[] = [];

  for (const link of links) {
    try {
      const response = await axios.get(link, {
        timeout: 8_000,
        validateStatus: () => true,
      });

      if (response.status >= 400) {
        results.push({ url: link, foundOn: siteUrl, statusCode: response.status });
      }
    } catch {
      results.push({ url: link, foundOn: siteUrl, statusCode: 0 });
    }
  }

  return results;
}

export async function generateMonitoringAlert(
  projectId: string,
  check: string,
  severity: AlertSeverity,
  data: Record<string, unknown>,
): Promise<Alert> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  let title = `${check} issue detected`;
  let message = "FlowIQ detected a website monitoring issue that needs attention.";
  let actionRequired = "Review the monitoring result details and fix the affected website component.";

  if (check === "SSL_CHECK") {
    const expiryDate = String(data.expiryDate ?? data.expiresAt ?? "the expiry date");
    title = "SSL certificate expiring soon";
    message = `The SSL certificate expires on ${expiryDate}. Visitors may see browser security warnings if it expires.`;
    actionRequired = MONITORING_ACTION_TEMPLATES.SSL_EXPIRY.replace("[expiryDate]", expiryDate);
  }

  if (check === "UPTIME_CHECK") {
    title = "Site is down";
    message = `The site did not respond successfully. Status code: ${String(data.statusCode ?? "unknown")}.`;
    actionRequired = MONITORING_ACTION_TEMPLATES.SITE_DOWN;
  }

  if (check === "CWV_CHECK") {
    title = "Core Web Vitals regression";
    message = `Largest Contentful Paint increased from ${String(data.oldValue)}s to ${String(data.newValue)}s.`;
    actionRequired = MONITORING_ACTION_TEMPLATES.LCP_REGRESSION
      .replace("[oldValue]", String(data.oldValue))
      .replace("[newValue]", String(data.newValue))
      .replace("[date]", String(data.date ?? "the previous check"));
  }

  if (check === "PLUGIN_CHECK") {
    title = "WordPress plugin outdated";
    message = `${String(data.pluginName ?? "A plugin")} needs an update.`;
    actionRequired = MONITORING_ACTION_TEMPLATES.PLUGIN_OUTDATED
      .replace("[plugin name]", String(data.pluginName ?? "the plugin"))
      .replace("[old]", String(data.oldVersion ?? "old"))
      .replace("[new]", String(data.newVersion ?? "latest"));
  }

  if (check === "LINK_CHECK") {
    title = "Broken links found";
    message = `${String(data.count ?? 0)} broken links were found on ${String(data.page ?? "the site")}.`;
    actionRequired = MONITORING_ACTION_TEMPLATES.BROKEN_LINK
      .replace("[count]", String(data.count ?? 0))
      .replace("[page]", String(data.page ?? "the affected page"))
      .replace("[broken URL]", String(data.brokenUrl ?? "the broken URL"));
  }

  return createAlert({
    workspaceId: project.workspaceId,
    projectId,
    severity,
    category: "WEBSITE",
    title,
    message,
    actionRequired,
    metadata: data as Prisma.InputJsonObject,
  });
}
