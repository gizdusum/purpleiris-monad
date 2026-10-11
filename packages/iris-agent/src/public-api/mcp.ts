import { getPublicToolCatalog } from "./catalog";
import { callPublicTool, ENVELOPE_SCHEMA, type CallDeps } from "./call";

/**
 * Stateless Model Context Protocol server (Streamable HTTP transport, JSON responses).
 *
 * The server exposes tools only, keeps no session, and never initiates messages,
 * so each POST is answered with a single `application/json` body and no SSE
 * stream is needed. That keeps it deployable on plain serverless functions.
 *
 * Spec: https://modelcontextprotocol.io/specification
 */

export const SERVER_INFO = {
  name: "purpleiris",
  title: "PurpleIris — Monad validator intelligence",
  version: "1.1.0",
} as const;

export const LATEST_PROTOCOL_VERSION = "2025-06-18";
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const SERVER_INSTRUCTIONS = [
  "PurpleIris is a read-only data source for Monad mainnet staking and validators.",
  "Every result carries data_class: 1 = read from chain, 2 = derived by a stated formula, 3 = estimate.",
  "Carry that label through to the user, and never present Class 3 values as guarantees.",
  "Results backed by the indexer include a freshness block; if freshness.stale is true, say the data is as of freshness.indexed_at.",
  "For live network totals use get_onchain_snapshot: it reads the staking precompile and returns the block it was read at.",
  "For one validator's live state, or a delegator's position with it, use get_validator_onchain.",
  "PurpleIris is non-advisory: report data, do not tell the user which validator to choose.",
].join(" ");

export const JSONRPC_ERRORS = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

type JsonRpcId = string | number;

type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | {
      jsonrpc: "2.0";
      id: JsonRpcId | null;
      error: { code: number; message: string; data?: unknown };
    };

export type McpHttpResult = {
  /** HTTP status to send. */
  status: number;
  /** JSON body, or null for 202 Accepted (notifications only). */
  body: JsonRpcResponse | JsonRpcResponse[] | null;
};

const MAX_BATCH = 20;

function rpcError(
  id: JsonRpcId | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

function isId(v: unknown): v is JsonRpcId {
  return typeof v === "string" || (typeof v === "number" && Number.isFinite(v));
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function listToolsResult() {
  return {
    tools: getPublicToolCatalog().map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: t.inputSchema,
      outputSchema: ENVELOPE_SCHEMA,
      annotations: {
        title: t.title,
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    })),
  };
}

function negotiateVersion(requested: unknown): string {
  return typeof requested === "string" &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;
}

/** Handle one JSON-RPC message. Returns null for notifications. */
export async function handleMcpMessage(
  message: unknown,
  deps: CallDeps = {}
): Promise<JsonRpcResponse | null> {
  if (!isObject(message) || message["jsonrpc"] !== "2.0" || typeof message["method"] !== "string") {
    // A response object sent by the client (has result/error, no method) is ignored.
    if (
      isObject(message) &&
      message["jsonrpc"] === "2.0" &&
      ("result" in message || "error" in message)
    ) {
      return null;
    }
    const id = isObject(message) && isId(message["id"]) ? message["id"] : null;
    return rpcError(id, JSONRPC_ERRORS.invalidRequest, "Invalid JSON-RPC 2.0 request");
  }

  const method = message["method"];
  const hasId = "id" in message;

  // Notifications get no response, whatever the method.
  if (!hasId) return null;

  const id = message["id"];
  if (!isId(id)) {
    return rpcError(null, JSONRPC_ERRORS.invalidRequest, "Request id must be a string or number");
  }

  const params = isObject(message["params"]) ? message["params"] : {};

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: negotiateVersion(params["protocolVersion"]),
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: SERVER_INSTRUCTIONS,
        },
      };

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return { jsonrpc: "2.0", id, result: listToolsResult() };

    case "tools/call": {
      const name = params["name"];
      if (typeof name !== "string" || name.length === 0) {
        return rpcError(id, JSONRPC_ERRORS.invalidParams, "tools/call requires params.name");
      }
      const args = params["arguments"];
      if (args !== undefined && args !== null && !isObject(args)) {
        return rpcError(id, JSONRPC_ERRORS.invalidParams, "params.arguments must be an object");
      }

      let outcome;
      try {
        outcome = await callPublicTool(name, args ?? {}, deps);
      } catch {
        return rpcError(id, JSONRPC_ERRORS.internalError, "Tool execution failed");
      }

      if (!outcome.ok) {
        if (outcome.code === "unknown_tool") {
          return rpcError(id, JSONRPC_ERRORS.invalidParams, outcome.message);
        }
        // Bad arguments are a tool-level error so the calling model can correct itself.
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: outcome.message }], isError: true },
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(outcome.envelope) }],
          structuredContent: outcome.envelope,
          isError: outcome.isError,
        },
      };
    }

    default:
      return rpcError(id, JSONRPC_ERRORS.methodNotFound, `Method not found: ${method}`);
  }
}

/** Handle a parsed POST body: a single message or a batch. */
export async function handleMcpBody(body: unknown, deps: CallDeps = {}): Promise<McpHttpResult> {
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return { status: 400, body: rpcError(null, JSONRPC_ERRORS.invalidRequest, "Empty batch") };
    }
    if (body.length > MAX_BATCH) {
      return {
        status: 400,
        body: rpcError(
          null,
          JSONRPC_ERRORS.invalidRequest,
          `Batch larger than ${MAX_BATCH} messages`
        ),
      };
    }
    const responses: JsonRpcResponse[] = [];
    for (const message of body) {
      const r = await handleMcpMessage(message, deps);
      if (r) responses.push(r);
    }
    return responses.length === 0 ? { status: 202, body: null } : { status: 200, body: responses };
  }

  const response = await handleMcpMessage(body, deps);
  if (!response) return { status: 202, body: null };
  const invalid = "error" in response && response.error.code === JSONRPC_ERRORS.invalidRequest;
  return { status: invalid ? 400 : 200, body: response };
}

/** Handle a raw POST body string, including JSON parse errors. */
export async function handleMcpRaw(raw: string, deps: CallDeps = {}): Promise<McpHttpResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      status: 400,
      body: rpcError(null, JSONRPC_ERRORS.parseError, "Parse error: body is not valid JSON"),
    };
  }
  return handleMcpBody(parsed, deps);
}
