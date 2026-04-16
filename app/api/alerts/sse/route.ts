import { auth } from "@clerk/nextjs/server";

import { addAlertClient, removeAlertClient } from "@/services/alert-service";
import { getCurrentWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json(
      { error: "You must be signed in.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const workspace = await getCurrentWorkspace(userId);

  if (!workspace) {
    return Response.json(
      { error: "Workspace not found.", code: "WORKSPACE_NOT_FOUND" },
      { status: 404 },
    );
  }

  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | null = null;
  let client: {
    controller: ReadableStreamDefaultController<Uint8Array>;
    encoder: TextEncoder;
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      client = { controller, encoder };
      addAlertClient(workspace.id, client);
      controller.enqueue(encoder.encode(": connected\n\n"));

      interval = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 30_000);

      request.signal.addEventListener("abort", () => {
        if (interval) clearInterval(interval);
        removeAlertClient(workspace.id, client);
        try {
          controller.close();
        } catch {
          // Connection may already be closed.
        }
      });
    },
    cancel() {
      if (interval) clearInterval(interval);
      if (client) removeAlertClient(workspace.id, client);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
