import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runOperatorIris } from "@purpleiris/iris-agent";
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { messages } = parsed.data;

  try {
    const result = await runOperatorIris(messages as IrisMessage[]);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/chat/operator]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const maxDuration = 120;
