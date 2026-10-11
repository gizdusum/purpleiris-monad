// POST /api/v1/tools/{name}   body: JSON arguments
// GET  /api/v1/tools/{name}   arguments as query parameters (handy for curl and browsers)
//
// Both return the same envelope the MCP endpoint returns as structuredContent.

import type { NextRequest } from "next/server";
import { callPublicTool, coerceQueryParams, findPublicTool } from "@purpleiris/iris-agent";
import { checkApiRateLimit } from "@/lib/ratelimit";
import { apiJson, CORS_HEADERS, preflight, readBody } from "@/lib/api-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: { name: string } };

async function run(name: string, input: unknown): Promise<Response> {
  let outcome;
  try {
    outcome = await callPublicTool(name, input);
  } catch (err) {
    console.error(`[/api/v1/tools/${name}]`, err);
    return apiJson({ error: "Tool execution failed" }, { status: 500 });
  }

  if (!outcome.ok) {
    return apiJson(
      { error: outcome.message, ...(outcome.errors ? { details: outcome.errors } : {}) },
      { status: outcome.code === "unknown_tool" ? 404 : 400 }
    );
  }
  // Tool-level failures (e.g. validator not found) still return the envelope, so
  // callers can read data.error, with a status that reflects the failure.
  return apiJson(outcome.envelope, { status: outcome.isError ? 422 : 200 });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const limited = await checkApiRateLimit(req, CORS_HEADERS);
  if (limited) return limited;

  const body = await readBody(req);
  if (!body.ok) return body.response;

  let input: unknown = {};
  if (body.text.trim().length > 0) {
    try {
      input = JSON.parse(body.text);
    } catch {
      return apiJson({ error: "Body is not valid JSON" }, { status: 400 });
    }
  }
  return run(params.name, input);
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const limited = await checkApiRateLimit(req, CORS_HEADERS);
  if (limited) return limited;

  const tool = findPublicTool(params.name);
  if (!tool) return apiJson({ error: `Unknown tool: ${params.name}` }, { status: 404 });

  const input = coerceQueryParams(tool.inputSchema, new URL(req.url).searchParams.entries());
  return run(params.name, input);
}

export function OPTIONS() {
  return preflight();
}
