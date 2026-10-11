// Model Context Protocol endpoint (Streamable HTTP transport, stateless).
//
//   POST /api/mcp   JSON-RPC 2.0 request, notification or batch → application/json
//   GET  /api/mcp   405: this server never initiates messages, so it offers no SSE stream
//
// Read-only: 15 tools over Monad staking and validator data. No auth, no session.

import type { NextRequest } from "next/server";
import { handleMcpRaw, SERVER_INFO, LATEST_PROTOCOL_VERSION } from "@purpleiris/iris-agent";
import { checkApiRateLimit } from "@/lib/ratelimit";
import { apiJson, CORS_HEADERS, methodNotAllowed, preflight, readBody } from "@/lib/api-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = await checkApiRateLimit(req, CORS_HEADERS);
  if (limited) return limited;

  const body = await readBody(req);
  if (!body.ok) return body.response;

  const result = await handleMcpRaw(body.text);

  if (result.body === null) {
    return new Response(null, { status: result.status, headers: CORS_HEADERS });
  }
  return apiJson(result.body, {
    status: result.status,
    headers: { "Mcp-Server": `${SERVER_INFO.name}/${SERVER_INFO.version}` },
  });
}

export function GET() {
  return apiJson(
    {
      error: "Method not allowed",
      hint: "This is a Model Context Protocol endpoint. Send JSON-RPC 2.0 over POST.",
      server: SERVER_INFO,
      protocolVersion: LATEST_PROTOCOL_VERSION,
      docs: "/developers",
    },
    { status: 405, headers: { Allow: "POST, OPTIONS" } }
  );
}

export function DELETE() {
  return methodNotAllowed("POST, OPTIONS");
}

export function OPTIONS() {
  return preflight();
}
