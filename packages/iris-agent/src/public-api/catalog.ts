import { getDelegatorToolDefinitions, getOperatorToolDefinitions } from "../tools/index";

/**
 * Public tool catalog.
 *
 * The same 16 tools the PurpleIris agent uses, described once and exposed three
 * ways: to the in-app agent (Anthropic tool definitions), over MCP (`/api/mcp`),
 * and over plain HTTP (`/api/v1/tools`). Every tool is read-only.
 */

export type PropertySchema = {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  items?: ObjectSchema | PropertySchema;
  properties?: Record<string, PropertySchema>;
  required?: string[];
};

export type ObjectSchema = {
  type: "object";
  properties: Record<string, PropertySchema>;
  required: string[];
  additionalProperties?: boolean;
};

export type PublicTool = {
  name: string;
  title: string;
  description: string;
  /** Which in-app mode introduced the tool. Both are public over the API. */
  mode: "delegator" | "operator";
  /**
   * Where the answer comes from:
   * `chain`   read live from the staking precompile, pinned to a block
   * `index`   read from the indexer's tables (result carries a `freshness` block)
   * `formula` computed from the arguments alone
   */
  backing: "chain" | "index" | "formula";
  inputSchema: ObjectSchema;
};

const TITLES: Record<string, string> = {
  get_onchain_snapshot: "Live on-chain network snapshot",
  get_validator_onchain: "Live on-chain validator and delegator position",
  get_validator: "Validator profile",
  list_validators: "List validators",
  get_network_health: "Network health",
  find_underdogs: "Find underdog validators",
  simulate_delegation: "Simulate a delegation",
  simulate_diversification: "Score a delegation split",
  estimate_stake_reward: "Estimate staking reward",
  get_recent_assignments: "Recent epoch history",
  get_network_overview: "Network overview",
  get_latest_monad_release: "Latest Monad release",
  get_assignment_predictor: "Round assignment predictor",
  get_anomaly_check: "Anomaly check",
  get_execution_revenue: "Execution revenue",
  get_staking_rewards: "Staking rewards",
};

const BACKING: Record<string, PublicTool["backing"]> = {
  get_onchain_snapshot: "chain",
  get_validator_onchain: "chain",
  estimate_stake_reward: "formula",
};

function normalizeSchema(raw: unknown): ObjectSchema {
  const s = (raw ?? {}) as Partial<ObjectSchema>;
  return {
    type: "object",
    properties: (s.properties ?? {}) as Record<string, PropertySchema>,
    required: Array.isArray(s.required) ? [...s.required] : [],
    additionalProperties: false,
  };
}

let cache: PublicTool[] | null = null;

export function getPublicToolCatalog(): PublicTool[] {
  if (cache) return cache;

  const delegatorNames = new Set(getDelegatorToolDefinitions().map((t) => t.name));
  const all = getOperatorToolDefinitions();

  const tools = all.map<PublicTool>((t) => ({
    name: t.name,
    title: TITLES[t.name] ?? t.name,
    description: t.description ?? "",
    mode: delegatorNames.has(t.name) ? "delegator" : "operator",
    backing: BACKING[t.name] ?? "index",
    inputSchema: normalizeSchema(t.input_schema),
  }));

  // Live chain read first: it is the tool an integrator should reach for by default.
  const rank = (t: PublicTool) =>
    t.name === "get_onchain_snapshot" ? 0 : t.backing === "chain" ? 1 : 2;
  tools.sort((a, b) => rank(a) - rank(b));

  cache = tools;
  return tools;
}

export function findPublicTool(name: string): PublicTool | undefined {
  return getPublicToolCatalog().find((t) => t.name === name);
}
