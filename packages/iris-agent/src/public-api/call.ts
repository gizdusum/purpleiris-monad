import { executeTool } from "../tools/index";
import type { ToolFreshness } from "../tools/types";
import { findPublicTool } from "./catalog";
import { validateToolInput } from "./validate";

export const METHODOLOGY_URL = "https://purpleiris.live/methodology";
export const DISCLAIMER =
  "PurpleIris surfaces data and analysis only. Nothing here is financial advice.";

const CLASS_LABELS = {
  1: "Class 1 — on-chain (deterministic)",
  2: "Class 2 — derived (formula-labelled)",
  3: "Class 3 — estimated (uncertainty-aware)",
} as const;

export type DataClass = 1 | 2 | 3;

/** The response envelope shared by MCP `structuredContent` and the REST API. */
export type PublicEnvelope = {
  tool: string;
  data: unknown;
  data_class: DataClass;
  data_class_label: string;
  source: string;
  /** When the tool ran. */
  timestamp: string;
  /** Age of the indexed data behind this result. Absent for live/pure tools. */
  freshness?: ToolFreshness;
  methodology_url: string;
  disclaimer: string;
};

export type CallOutcome =
  | { ok: true; envelope: PublicEnvelope; isError: boolean }
  | { ok: false; code: "unknown_tool" | "invalid_input"; message: string; errors?: string[] };

export type ToolExecutor = (name: string, input: unknown) => Promise<string>;

export type CallDeps = {
  /** Injected in tests; defaults to the real tool executor. */
  execute?: ToolExecutor;
};

function isDataClass(v: unknown): v is DataClass {
  return v === 1 || v === 2 || v === 3;
}

export async function callPublicTool(
  name: string,
  rawInput: unknown,
  deps: CallDeps = {}
): Promise<CallOutcome> {
  const tool = findPublicTool(name);
  if (!tool) {
    return { ok: false, code: "unknown_tool", message: `Unknown tool: ${name}` };
  }

  const validated = validateToolInput(tool.inputSchema, rawInput);
  if (!validated.ok) {
    return {
      ok: false,
      code: "invalid_input",
      message: `Invalid arguments for ${name}: ${validated.errors.join("; ")}`,
      errors: validated.errors,
    };
  }

  const execute = deps.execute ?? executeTool;
  const raw = await execute(name, validated.value);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = {
      data: { error: "Tool returned an unreadable result." },
      data_class: 1,
      source: name,
    };
  }

  const dataClass: DataClass = isDataClass(parsed["data_class"]) ? parsed["data_class"] : 1;
  const data = parsed["data"];
  const isError =
    data !== null &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "error" in (data as object);

  const envelope: PublicEnvelope = {
    tool: name,
    data,
    data_class: dataClass,
    data_class_label: CLASS_LABELS[dataClass],
    source: typeof parsed["source"] === "string" ? (parsed["source"] as string) : name,
    timestamp:
      typeof parsed["timestamp"] === "string"
        ? (parsed["timestamp"] as string)
        : new Date().toISOString(),
    ...(parsed["freshness"] ? { freshness: parsed["freshness"] as ToolFreshness } : {}),
    methodology_url: METHODOLOGY_URL,
    disclaimer: DISCLAIMER,
  };

  return { ok: true, envelope, isError };
}

/** JSON Schema for PublicEnvelope, used as MCP outputSchema and in OpenAPI. */
export const ENVELOPE_SCHEMA = {
  type: "object",
  properties: {
    tool: { type: "string" },
    data: { description: "Tool-specific payload." },
    data_class: {
      type: "integer",
      enum: [1, 2, 3],
      description: "1 on-chain, 2 derived, 3 estimated. See the methodology page.",
    },
    data_class_label: { type: "string" },
    source: { type: "string" },
    timestamp: { type: "string", description: "ISO-8601 time the tool ran." },
    freshness: {
      type: "object",
      description: "Age of the indexed data behind this result. Absent for live tools.",
      properties: {
        indexed_at: { type: ["string", "null"] },
        age_hours: { type: ["number", "null"] },
        stale: { type: "boolean" },
        note: { type: "string" },
      },
      required: ["indexed_at", "age_hours", "stale"],
    },
    methodology_url: { type: "string" },
    disclaimer: { type: "string" },
  },
  required: ["tool", "data", "data_class", "data_class_label", "source", "timestamp"],
} as const;
