// GET /api/v1/tools — the tool catalog with JSON Schemas.

import type { NextRequest } from "next/server";
import { getPublicToolCatalog, SERVER_INFO } from "@purpleiris/iris-agent";
import { apiJson, preflight, publicBaseUrl } from "@/lib/api-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const base = publicBaseUrl(req);
  return apiJson(
    {
      server: SERVER_INFO,
      mcp_endpoint: `${base}/api/mcp`,
      openapi: `${base}/api/v1/openapi.json`,
      methodology: `${base}/methodology`,
      tools: getPublicToolCatalog().map((t) => ({
        name: t.name,
        title: t.title,
        description: t.description,
        mode: t.mode,
        backing: t.backing,
        input_schema: t.inputSchema,
        url: `${base}/api/v1/tools/${t.name}`,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}

export function OPTIONS() {
  return preflight();
}
