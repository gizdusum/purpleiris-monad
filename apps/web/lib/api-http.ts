import type { NextRequest } from "next/server";

/**
 * Shared HTTP helpers for the public data API (`/api/mcp`, `/api/v1/*`).
 *
 * The API is read-only, unauthenticated and cookie-free, so any origin may call
 * it: browser-based MCP clients and dashboards need CORS to do so.
 */

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Max-Age": "86400",
};

export const MAX_BODY_BYTES = 64 * 1024;

export function apiJson(
  body: unknown,
  init: { status?: number; headers?: HeadersInit } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...CORS_HEADERS,
      ...init.headers,
    },
  });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function methodNotAllowed(allow: string): Response {
  return apiJson({ error: "Method not allowed" }, { status: 405, headers: { Allow: allow } });
}

export type BodyResult = { ok: true; text: string } | { ok: false; response: Response };

/** Read the request body as text, refusing anything larger than MAX_BODY_BYTES. */
export async function readBody(req: NextRequest): Promise<BodyResult> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false, response: apiJson({ error: "Request body too large" }, { status: 413 }) };
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { ok: false, response: apiJson({ error: "Request body too large" }, { status: 413 }) };
  }
  return { ok: true, text };
}

export function publicBaseUrl(req: NextRequest): string {
  const configured = process.env["NEXT_PUBLIC_APP_URL"]?.replace(/\/+$/, "");
  if (configured) return configured;
  return new URL(req.url).origin;
}
