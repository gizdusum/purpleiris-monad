import { getPublicToolCatalog } from "./catalog";
import { ENVELOPE_SCHEMA, DISCLAIMER } from "./call";
import { SERVER_INFO } from "./mcp";

/** OpenAPI 3.1 description of the REST API, generated from the tool catalog. */
export function buildOpenApiDocument(baseUrl: string) {
  const paths: Record<string, unknown> = {
    "/api/v1/tools": {
      get: {
        operationId: "listTools",
        summary: "List every tool with its JSON Schema",
        responses: { "200": { description: "Tool catalog" } },
      },
    },
  };

  for (const tool of getPublicToolCatalog()) {
    const hasArgs = Object.keys(tool.inputSchema.properties).length > 0;
    paths[`/api/v1/tools/${tool.name}`] = {
      post: {
        operationId: tool.name,
        summary: tool.title,
        description: tool.description,
        ...(hasArgs
          ? {
              requestBody: {
                required: tool.inputSchema.required.length > 0,
                content: { "application/json": { schema: tool.inputSchema } },
              },
            }
          : {}),
        responses: {
          "200": {
            description: "Tool result envelope",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Envelope" } } },
          },
          "400": { description: "Invalid arguments" },
          "404": { description: "Unknown tool" },
          "429": { description: "Rate limited" },
        },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: SERVER_INFO.title,
      version: SERVER_INFO.version,
      description: `Read-only Monad validator and staking data. Every response is labelled with a data class (1 on-chain, 2 derived, 3 estimated). ${DISCLAIMER}`,
      license: { name: "MIT" },
    },
    servers: [{ url: baseUrl }],
    paths,
    components: { schemas: { Envelope: ENVELOPE_SCHEMA } },
  };
}
