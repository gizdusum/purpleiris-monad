import type { NextRequest } from "next/server";
import { streamOperatorIris } from "@purpleiris/iris-agent";
import type { IrisMessage } from "@purpleiris/iris-agent";
import { z } from "zod";
import { checkRateLimit } from "../../../../lib/ratelimit";

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
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limited = await checkRateLimit(ip);
  if (limited) return limited;

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
        const meta = await streamOperatorIris(messages as IrisMessage[], (chunk) =>
          send({ type: "delta", text: chunk })
        );

        send({
          type: "done",
          tool_calls: meta.tool_calls.length,
        });
      } catch (err) {
        console.error("[/api/chat/operator stream]", err);
        send({
          type: "error",
          message: "Service temporarily unavailable. Please try again.",
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
