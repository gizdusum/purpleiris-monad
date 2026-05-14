import type Anthropic from "@anthropic-ai/sdk";
import { getValidatorTool } from "./get-validator";
import { listValidatorsTool } from "./list-validators";
import { getNetworkHealthTool } from "./get-network-health";
import { findUnderdogsTool } from "./find-underdogs";
import { simulateDelegationTool } from "./simulate-delegation";
import { simulateDiversificationTool } from "./simulate-diversification";
import type {
  GetValidatorInput,
  ListValidatorsInput,
  FindUnderdogsInput,
  SimulateDelegationInput,
  SimulateDiversificationInput,
  ToolResult,
} from "./types";

export type { ToolResult };

// Anthropic tool definitions — the last one gets prompt cache_control
export function getDelegatorToolDefinitions(): Anthropic.Tool[] {
  return [
    {
      name: "get_validator",
      description:
        "Look up a specific validator's full profile: commission, stake, jail status, and 7d/30d/all-time block production metrics. Use this for any question about a specific validator.",
      input_schema: {
        type: "object" as const,
        properties: {
          id: {
            type: "string",
            description: "Validator address (0x...) or slug (e.g. 'chorus-one')",
          },
        },
        required: ["id"],
      },
    },
    {
      name: "list_validators",
      description:
        "List validators with optional filters. Use for browsing or finding validators matching criteria (commission cap, region, infra provider, minimum stake).",
      input_schema: {
        type: "object" as const,
        properties: {
          active_only: {
            type: "boolean",
            description: "Only return active, non-jailed validators (default: true)",
          },
          max_commission_bps: {
            type: "number",
            description: "Maximum commission in basis points (e.g. 500 = 5%)",
          },
          min_stake_mon: { type: "number", description: "Minimum total staked MON" },
          region: { type: "string", description: "Filter by geographic region" },
          infra_provider: {
            type: "string",
            description: "Filter by infrastructure provider (e.g. 'AWS', 'Hetzner')",
          },
          limit: { type: "number", description: "Maximum results (default 50, max 100)" },
        },
        required: [],
      },
    },
    {
      name: "get_network_health",
      description:
        "Get current Monad network health: active validator count, total stake, success rate, and Nakamoto coefficient. Use for network-level questions.",
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "find_underdogs",
      description:
        "Find underdog validators: high performance but lower stake rank. Good for users who want to support decentralization.",
      input_schema: {
        type: "object" as const,
        properties: {
          min_success_rate: {
            type: "number",
            description: "Minimum 30-day success rate % (default: 95)",
          },
          max_stake_rank: {
            type: "number",
            description: "Only consider validators outside this stake rank (default: 100)",
          },
          limit: { type: "number", description: "How many results to return (default: 10)" },
        },
        required: [],
      },
    },
    {
      name: "simulate_delegation",
      description:
        "Class 3 estimate: project expected MON rewards and APY range for delegating a given amount to a specific validator over N days. Always cite as Class 3 with confidence interval.",
      input_schema: {
        type: "object" as const,
        properties: {
          validator_id: { type: "string", description: "Validator address or slug" },
          stake_mon: { type: "number", description: "Amount of MON to delegate" },
          days: { type: "number", description: "Duration in days for the simulation" },
        },
        required: ["validator_id", "stake_mon", "days"],
      },
    },
    {
      name: "simulate_diversification",
      description:
        "Class 2 formula: compute Shannon entropy diversity score for a proposed delegation split across multiple validators. Returns validator, region, and infra diversity scores. MANDATORY for ANY question about diversification, including single-validator scenarios (pass one allocation), comparisons between splits, and 'is X more diverse than Y' questions — never answer diversification questions from reasoning alone.",
      input_schema: {
        type: "object" as const,
        properties: {
          allocations: {
            type: "array",
            description: "List of validator allocations",
            items: {
              type: "object",
              properties: {
                validator_id: { type: "string", description: "Validator address or slug" },
                stake_mon: { type: "number", description: "MON amount for this validator" },
              },
              required: ["validator_id", "stake_mon"],
            },
          },
        },
        required: ["allocations"],
      },
      // Prompt cache breakpoint: caches system prompt + all tool definitions
      cache_control: { type: "ephemeral" },
    },
  ];
}

// Execute a tool by name and return serialized JSON
export async function executeTool(name: string, input: unknown): Promise<string> {
  let result: ToolResult;

  switch (name) {
    case "get_validator":
      result = await getValidatorTool(input as GetValidatorInput);
      break;
    case "list_validators":
      result = await listValidatorsTool((input as ListValidatorsInput) ?? {});
      break;
    case "get_network_health":
      result = await getNetworkHealthTool();
      break;
    case "find_underdogs":
      result = await findUnderdogsTool((input as FindUnderdogsInput) ?? {});
      break;
    case "simulate_delegation":
      result = await simulateDelegationTool(input as SimulateDelegationInput);
      break;
    case "simulate_diversification":
      result = await simulateDiversificationTool(input as SimulateDiversificationInput);
      break;
    default:
      result = {
        data: { error: `Unknown tool: ${name}` },
        data_class: 1,
        source: name,
        timestamp: new Date().toISOString(),
      };
  }

  return JSON.stringify(result, (_, v) => (typeof v === "bigint" ? v.toString() : v));
}
