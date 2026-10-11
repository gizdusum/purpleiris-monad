// GET /api/v1/openapi.json — OpenAPI 3.1 document generated from the tool catalog.

import type { NextRequest } from "next/server";
import { buildOpenApiDocument } from "@purpleiris/iris-agent";
import { apiJson, preflight, publicBaseUrl } from "@/lib/api-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export function GET(req: NextRequest) {
  return apiJson(buildOpenApiDocument(publicBaseUrl(req)), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}

export function OPTIONS() {
  return preflight();
}
