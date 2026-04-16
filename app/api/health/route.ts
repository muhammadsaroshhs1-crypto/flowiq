import IORedis from "ioredis";

import { APP_VERSION } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ok" | "error" = "ok";
  let redis: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  if (!process.env.REDIS_URL) {
    redis = "error";
  } else {
    const client = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    try {
      await client.connect();
      await client.ping();
    } catch {
      redis = "error";
    } finally {
      await client.quit().catch(() => undefined);
    }
  }

  return Response.json({
    status: database === "ok" && redis === "ok" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    checks: { database, redis },
  });
}
