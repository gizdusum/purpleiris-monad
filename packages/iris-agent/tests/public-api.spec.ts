/**
 * Public API layer: tool catalog, input validation, response envelope.
 * No network, no database, no LLM — the tool executor is injected.
 */
import { describe, it, expect } from "vitest";
import {
  getPublicToolCatalog,
  findPublicTool,
  validateToolInput,
  coerceQueryParams,
  callPublicTool,
  buildOpenApiDocument,
  LIMITS,
} from "../src/public-api/index";
import { INDEX_BACKED_TOOLS, toToolFreshness } from "../src/tools/index";

const fakeExecute = (payload: unknown) => async () => JSON.stringify(payload);

describe("tool catalog", () => {
  const tools = getPublicToolCatalog();

  it("exposes all 16 tools with unique names", () => {
    expect(tools).toHaveLength(16);
    expect(new Set(tools.map((t) => t.name)).size).toBe(16);
  });

  it("lists the live chain read first", () => {
    expect(tools[0]?.name).toBe("get_onchain_snapshot");
    expect(tools[0]?.backing).toBe("chain");
  });

  it("gives every tool a title, a description and a closed object schema", () => {
    for (const t of tools) {
      expect(t.title.length).toBeGreaterThan(3);
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.inputSchema.type).toBe("object");
      expect(t.inputSchema.additionalProperties).toBe(false);
      for (const req of t.inputSchema.required) {
        expect(t.inputSchema.properties).toHaveProperty(req);
      }
    }
  });

  it("splits tools into the two in-app modes", () => {
    expect(
      tools
        .filter((t) => t.mode === "operator")
        .map((t) => t.name)
        .sort()
    ).toEqual([
      "get_anomaly_check",
      "get_assignment_predictor",
      "get_execution_revenue",
      "get_staking_rewards",
    ]);
  });

  it("labels where each tool's answer comes from, consistently with freshness tagging", () => {
    for (const t of tools) {
      expect(t.backing === "index").toBe(INDEX_BACKED_TOOLS.has(t.name));
    }
    expect(tools.filter((t) => t.backing === "chain").map((t) => t.name)).toEqual(["get_onchain_snapshot", "get_validator_onchain"]);
    expect(tools.filter((t) => t.backing === "formula").map((t) => t.name)).toEqual([
      "estimate_stake_reward",
    ]);
  });

  it("does not leak prompt-cache hints into public schemas", () => {
    expect(JSON.stringify(tools)).not.toContain("cache_control");
  });
});

describe("input validation", () => {
  const schema = (name: string) => findPublicTool(name)!.inputSchema;

  it("accepts valid arguments and trims strings", () => {
    const r = validateToolInput(schema("get_validator"), { id: "  backpack " });
    expect(r).toEqual({ ok: true, value: { id: "backpack" } });
  });

  it("treats missing input as an empty object", () => {
    expect(validateToolInput(schema("get_network_health"), undefined)).toEqual({
      ok: true,
      value: {},
    });
  });

  it("reports missing required arguments", () => {
    const r = validateToolInput(schema("simulate_delegation"), { validator_id: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/stake_mon: required.*days: required/);
  });

  it("rejects unknown arguments and names the expected ones", () => {
    const r = validateToolInput(schema("get_validator"), { id: "x", validator: "y" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/validator: unknown argument \(expected one of: id\)/);
  });

  it("rejects wrong types, non-finite numbers and out-of-range values", () => {
    const s = schema("estimate_stake_reward");
    expect(validateToolInput(s, { stake_mon: "100", days: 30 }).ok).toBe(false);
    expect(validateToolInput(s, { stake_mon: Infinity, days: 30 }).ok).toBe(false);
    expect(validateToolInput(s, { stake_mon: 1e18, days: 30 }).ok).toBe(false);
    expect(validateToolInput(s, { stake_mon: 100, days: 30 }).ok).toBe(true);
  });

  it("bounds string length and rejects control characters", () => {
    const s = schema("get_validator");
    expect(validateToolInput(s, { id: "a".repeat(LIMITS.maxStringLength + 1) }).ok).toBe(false);
    expect(validateToolInput(s, { id: "abc\u0000def" }).ok).toBe(false);
    expect(validateToolInput(s, { id: "   " }).ok).toBe(false);
  });

  it("validates nested array items", () => {
    const s = schema("simulate_diversification");
    expect(validateToolInput(s, { allocations: [{ validator_id: "a", stake_mon: 10 }] }).ok).toBe(
      true
    );
    const bad = validateToolInput(s, { allocations: [{ validator_id: "a" }] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]).toMatch(/allocations\[0\]\.stake_mon: required/);
    expect(
      validateToolInput(s, {
        allocations: Array.from({ length: LIMITS.maxArrayLength + 1 }, () => ({
          validator_id: "a",
          stake_mon: 1,
        })),
      }).ok
    ).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(validateToolInput(schema("get_validator"), "backpack").ok).toBe(false);
    expect(validateToolInput(schema("get_validator"), ["backpack"]).ok).toBe(false);
  });

  it("coerces query parameters by schema type", () => {
    const s = schema("list_validators");
    const coerced = coerceQueryParams(s, [
      ["active_only", "true"],
      ["max_commission_bps", "500"],
      ["region", "EU"],
      ["limit", "abc"],
    ]);
    expect(coerced).toEqual({
      active_only: true,
      max_commission_bps: 500,
      region: "EU",
      limit: "abc",
    });
    expect(validateToolInput(s, coerced).ok).toBe(false); // "abc" is still not a number
  });
});

describe("response envelope", () => {
  it("wraps a tool result with its class label and methodology link", async () => {
    const out = await callPublicTool(
      "get_network_health",
      {},
      {
        execute: fakeExecute({
          data: { active_validators: 196 },
          data_class: 1,
          source: "get_network_health",
          timestamp: "2026-10-11T12:00:00.000Z",
          freshness: { indexed_at: "2026-10-11T11:00:00.000Z", age_hours: 1, stale: false },
        }),
      }
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.isError).toBe(false);
    expect(out.envelope).toMatchObject({
      tool: "get_network_health",
      data: { active_validators: 196 },
      data_class: 1,
      data_class_label: "Class 1 — on-chain (deterministic)",
      timestamp: "2026-10-11T12:00:00.000Z",
      freshness: { stale: false },
      methodology_url: "https://purpleiris.live/methodology",
    });
  });

  it("flags tool-level errors without throwing", async () => {
    const out = await callPublicTool(
      "get_validator",
      { id: "nope" },
      {
        execute: fakeExecute({
          data: { error: "Validator not found" },
          data_class: 1,
          source: "get_validator",
        }),
      }
    );
    expect(out.ok && out.isError).toBe(true);
  });

  it("never calls the executor for unknown tools or invalid input", async () => {
    let calls = 0;
    const execute = async () => {
      calls++;
      return "{}";
    };
    const unknown = await callPublicTool("drop_table", {}, { execute });
    expect(unknown).toMatchObject({ ok: false, code: "unknown_tool" });
    const invalid = await callPublicTool("get_validator", {}, { execute });
    expect(invalid).toMatchObject({ ok: false, code: "invalid_input" });
    expect(calls).toBe(0);
  });

  it("passes only validated arguments to the executor", async () => {
    let seen: unknown;
    await callPublicTool(
      "get_validator",
      { id: " Backpack " },
      {
        execute: async (_n, input) => {
          seen = input;
          return JSON.stringify({ data: {}, data_class: 1, source: "get_validator" });
        },
      }
    );
    expect(seen).toEqual({ id: "Backpack" });
  });

  it("survives an unreadable tool result", async () => {
    const out = await callPublicTool("get_network_health", {}, { execute: async () => "not json" });
    expect(out.ok && out.isError).toBe(true);
  });
});

describe("freshness labelling", () => {
  it("adds no note while the index is fresh", () => {
    const f = toToolFreshness({
      indexedAt: "2026-10-11T11:00:00.000Z",
      ageSeconds: 3600,
      stale: false,
    });
    expect(f).toEqual({ indexed_at: "2026-10-11T11:00:00.000Z", age_hours: 1, stale: false });
  });

  it("tells the model to state the date when the index is stale", () => {
    const f = toToolFreshness({
      indexedAt: "2026-08-01T11:07:49.819Z",
      ageSeconds: 71 * 86400,
      stale: true,
    });
    expect(f.stale).toBe(true);
    expect(f.note).toContain("2026-08-01T11:07:49.819Z");
    expect(f.note).toContain("71 days");
    expect(f.note).toContain("get_onchain_snapshot");
  });

  it("treats an unknown age as stale", () => {
    const f = toToolFreshness({ indexedAt: null, ageSeconds: null, stale: true });
    expect(f.age_hours).toBeNull();
    expect(f.note).toMatch(/could not be determined/);
  });
});

describe("OpenAPI document", () => {
  it("has one POST operation per tool", () => {
    const doc = buildOpenApiDocument("https://purpleiris.live");
    const paths = Object.keys(doc.paths);
    expect(paths).toContain("/api/v1/tools");
    expect(paths.filter((p) => p.startsWith("/api/v1/tools/"))).toHaveLength(16);
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers[0]?.url).toBe("https://purpleiris.live");
  });
});
