import { startScheduler } from "@/workers/scheduler";

export const dynamic = "force-dynamic";

let started = false;

export async function GET() {
  if (started) {
    return Response.json({ ok: true, message: "Scheduler already initialized." });
  }

  if (!process.env.REDIS_URL) {
    return Response.json({
      ok: true,
      message: "Scheduler skipped because REDIS_URL is not configured.",
    });
  }

  try {
    await startScheduler();
    started = true;
    return Response.json({ ok: true, message: "Scheduler initialized." });
  } catch (error) {
    console.error("Failed to initialize scheduler.", error);
    return Response.json(
      { error: "Could not initialize scheduler.", code: "SCHEDULER_INIT_FAILED" },
      { status: 500 },
    );
  }
}
