/**
 * MCP server (stateless Streamable HTTP, JSON responses).
 * Exercises the JSON-RPC surface a real MCP client uses.
 */
import { describe, it, expect } from "vitest";
import {
  handleMcpBody,
  handleMcpRaw,
  handleMcpMessage,
  JSONRPC_ERRORS,
  LATEST_PROTOCOL_VERSION,
  SERVER_INFO,
} from "../src/public-api/index";

const execute = async (name: string, input: unknown) =>
  JSON.stringify({
    data: { echoed: input },
    data_class: name === "estimate_stake_reward" ? 3 : 1,
    source: name,
    timestamp: "2026-10-11T12:00:00.000Z",
  });

const deps = { execute };
const rpc = (method: string, params?: unknown, id: number | string = 1) => ({
  jsonrpc: "2.0" as const,
  id,
  method,
  ...(params === undefined ? {} : { params }),
});

describe("initialize", () => {
  it("echoes a supported protocol version and declares tools only", async () => {
    const r = await handleMcpBody(
      rpc("initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      }),
      deps
    );
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      },
    });
    const result = (r.body as { result: { capabilities: object; instructions: string } }).result;
    expect(Object.keys(result.capabilities)).toEqual(["tools"]);
    expect(result.instructions).toMatch(/non-advisory/);
  });

  it("falls back to the latest version for an unknown one", async () => {
    const r = await handleMcpBody(rpc("initialize", { protocolVersion: "1999-01-01" }), deps);
    expect((r.body as { result: { protocolVersion: string } }).result.protocolVersion).toBe(
      LATEST_PROTOCOL_VERSION
    );
  });
});

describe("tools/list", () => {
  it("returns 16 read-only tools with input and output schemas", async () => {
    const r = await handleMcpBody(rpc("tools/list"), deps);
    const tools = (r.body as { result: { tools: Array<Record<string, unknown>> } }).result.tools;
    expect(tools).toHaveLength(16);
    for (const t of tools) {
      expect(t["inputSchema"]).toMatchObject({ type: "object" });
      expect(t["outputSchema"]).toMatchObject({ type: "object" });
      expect(t["annotations"]).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    }
  });
});

describe("tools/call", () => {
  it("returns text content plus structuredContent", async () => {
    const r = await handleMcpBody(
      rpc("tools/call", {
        name: "estimate_stake_reward",
        arguments: { stake_mon: 1000, days: 30 },
      }),
      deps
    );
    const result = (r.body as { result: Record<string, unknown> }).result;
    expect(result["isError"]).toBe(false);
    expect(result["structuredContent"]).toMatchObject({
      tool: "estimate_stake_reward",
      data_class: 3,
      data: { echoed: { stake_mon: 1000, days: 30 } },
    });
    const content = result["content"] as Array<{ type: string; text: string }>;
    expect(content[0]?.type).toBe("text");
    expect(JSON.parse(content[0]!.text)).toEqual(result["structuredContent"]);
  });

  it("accepts a call with no arguments for argument-less tools", async () => {
    const r = await handleMcpBody(rpc("tools/call", { name: "get_network_health" }), deps);
    expect((r.body as { result: { isError: boolean } }).result.isError).toBe(false);
  });

  it("reports bad arguments as a tool error the model can read", async () => {
    const r = await handleMcpBody(
      rpc("tools/call", { name: "get_validator", arguments: {} }),
      deps
    );
    const result = (r.body as { result: { isError: boolean; content: Array<{ text: string }> } })
      .result;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/id: required/);
  });

  it("rejects an unknown tool as a protocol error", async () => {
    const r = await handleMcpBody(
      rpc("tools/call", { name: "transfer_funds", arguments: {} }),
      deps
    );
    expect(r.body).toMatchObject({ error: { code: JSONRPC_ERRORS.invalidParams } });
  });

  it("rejects malformed params", async () => {
    const noName = await handleMcpBody(rpc("tools/call", {}), deps);
    expect(noName.body).toMatchObject({ error: { code: JSONRPC_ERRORS.invalidParams } });
    const badArgs = await handleMcpBody(
      rpc("tools/call", { name: "get_validator", arguments: "x" }),
      deps
    );
    expect(badArgs.body).toMatchObject({ error: { code: JSONRPC_ERRORS.invalidParams } });
  });

  it("turns an executor crash into an internal error, not a thrown exception", async () => {
    const r = await handleMcpBody(rpc("tools/call", { name: "get_network_health" }), {
      execute: async () => {
        throw new Error("db down");
      },
    });
    expect(r.body).toMatchObject({ error: { code: JSONRPC_ERRORS.internalError } });
    expect(JSON.stringify(r.body)).not.toContain("db down");
  });
});

describe("JSON-RPC plumbing", () => {
  it("answers ping", async () => {
    expect((await handleMcpBody(rpc("ping", undefined, "abc"), deps)).body).toEqual({
      jsonrpc: "2.0",
      id: "abc",
      result: {},
    });
  });

  it("returns 202 with no body for notifications", async () => {
    const r = await handleMcpBody({ jsonrpc: "2.0", method: "notifications/initialized" }, deps);
    expect(r).toEqual({ status: 202, body: null });
  });

  it("ignores client responses", async () => {
    expect(await handleMcpMessage({ jsonrpc: "2.0", id: 5, result: {} }, deps)).toBeNull();
  });

  it("returns method-not-found for capabilities it does not declare", async () => {
    for (const method of ["resources/list", "prompts/list", "sampling/createMessage"]) {
      const r = await handleMcpBody(rpc(method), deps);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ error: { code: JSONRPC_ERRORS.methodNotFound } });
    }
  });

  it("rejects invalid requests with 400", async () => {
    for (const bad of [
      { id: 1, method: "ping" },
      { jsonrpc: "1.0", id: 1, method: "ping" },
      42,
      null,
      "ping",
    ]) {
      const r = await handleMcpBody(bad, deps);
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ error: { code: JSONRPC_ERRORS.invalidRequest } });
    }
    const badId = await handleMcpBody({ jsonrpc: "2.0", id: { a: 1 }, method: "ping" }, deps);
    expect(badId.body).toMatchObject({ id: null, error: { code: JSONRPC_ERRORS.invalidRequest } });
  });

  it("reports a parse error for a non-JSON body", async () => {
    const r = await handleMcpRaw("{not json", deps);
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ id: null, error: { code: JSONRPC_ERRORS.parseError } });
  });

  it("handles batches and drops notifications from the reply", async () => {
    const r = await handleMcpBody(
      [
        rpc("ping", undefined, 1),
        { jsonrpc: "2.0", method: "notifications/initialized" },
        rpc("tools/list", undefined, 2),
      ],
      deps
    );
    expect(r.status).toBe(200);
    expect((r.body as Array<{ id: number }>).map((m) => m.id)).toEqual([1, 2]);
  });

  it("rejects empty and oversized batches", async () => {
    expect((await handleMcpBody([], deps)).status).toBe(400);
    const big = Array.from({ length: 21 }, (_, i) => rpc("ping", undefined, i));
    expect((await handleMcpBody(big, deps)).status).toBe(400);
  });

  it("answers a notifications-only batch with 202", async () => {
    const r = await handleMcpBody([{ jsonrpc: "2.0", method: "notifications/initialized" }], deps);
    expect(r).toEqual({ status: 202, body: null });
  });
});
