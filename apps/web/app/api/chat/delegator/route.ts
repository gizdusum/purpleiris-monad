import type { NextRequest } from "next/server";
import { streamDelegatorIris } from "@purpleiris/iris-agent";
import type { IrisMessage } from "@purpleiris/iris-agent";
import { z } from "zod";

const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(20),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid request", details: parsed.error.flatten() }),
      { status: 400 }
    );
  }

  const { messages } = parsed.data;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      try {
        const meta = await streamDelegatorIris(messages as IrisMessage[], (chunk) =>
          send({ type: "delta", text: chunk })
        );

        send({
          type: "done",
          tool_calls: meta.tool_calls.length,
          guard_passed: meta.guard_passed,
        });
      } catch (err) {
        console.error("[/api/chat/delegator stream]", err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Internal error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 120;
