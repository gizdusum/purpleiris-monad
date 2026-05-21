import type Anthropic from "@anthropic-ai/sdk";
import { getValidatorTool } from "./get-validator";
import { listValidatorsTool } from "./list-validators";
import { getNetworkHealthTool } from "./get-network-health";
import { findUnderdogsTool } from "./find-underdogs";
import { simulateDelegationTool } from "./simulate-delegation";
import { simulateDiversificationTool } from "./simulate-diversification";
import { estimateStakeRewardTool } from "./estimate-stake-reward";
import { getRecentAssignmentsTool } from "./get-recent-assignments";
import { getNetworkOverviewTool } from "./get-network-overview";
import { getLatestMonadReleaseTool } from "./get-latest-monad-release";
import { getAssignmentPredictorTool } from "./get-assignment-predictor";
import { getAnomalyCheckTool } from "./get-anomaly-check";
import { getExecutionRevenueTool } from "./get-execution-revenue";
import type {
  GetValidatorInput,
  ListValidatorsInput,
  FindUnderdogsInput,
  SimulateDelegationInput,
  SimulateDiversificationInput,
  EstimateStakeRewardInput,
  GetRecentAssignmentsInput,
  GetAssignmentPredictorInput,
  GetAnomalyCheckInput,
  GetExecutionRevenueInput,
  ToolResult,
} from "./types";

export type { ToolResult };

// Delegator tool definitions
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
    {
      name: "estimate_stake_reward",
      description:
        "Quick Class 3 estimate of staking rewards given stake amount, duration in days, and optional commission in basis points. Use when the user asks a general 'what will I earn' question WITHOUT specifying a validator. For validator-specific projections using historical block data, prefer simulate_delegation.",
      input_schema: {
        type: "object" as const,
        properties: {
          stake_mon: { type: "number", description: "Amount of MON to stake" },
          days: { type: "number", description: "Duration in days" },
          commission_bps: {
            type: "number",
            description: "Commission rate in basis points (default: 500 = 5%)",
          },
        },
        required: ["stake_mon", "days"],
      },
    },
    {
      name: "get_recent_assignments",
      description:
        "Fetch epoch-level block assignment history for a specific validator, newest first. Returns per-epoch blocks proposed, missed, and success rate. Use for questions about a validator's recent activity, consistency over time, or to identify degraded epochs.",
      input_schema: {
        type: "object" as const,
        properties: {
          validator_id: {
            type: "string",
            description: "Validator address (0x...) or slug (e.g. 'chorus-one')",
          },
          limit: {
            type: "number",
            description: "Number of epochs to return (default: 20, max: 100)",
          },
        },
        required: ["validator_id"],
      },
    },
    {
      name: "get_network_overview",
      description:
        "Get a comprehensive network-wide summary: total and active validator counts, current epoch, live network uptime from Watchtower, 30-day aggregated success rate, alert distribution, and top validators by uptime. Use for broad network health questions and current state snapshots.",
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "get_latest_monad_release",
      description:
        "Fetch the latest Monad protocol release from the database (synced from GitHub). Returns the most recent release tag, publication date, summary, and up to 5 previous releases. Use when asked about recent protocol updates, current Monad version, or release history.",
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
  ];
}

// Operator tool definitions — includes all delegator tools plus operator-specific ones
export function getOperatorToolDefinitions(): Anthropic.Tool[] {
  // Delegator tools without cache_control (we'll set it on the last operator tool)
  const delegatorTools = getDelegatorToolDefinitions().map((t) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cache_control: _cc, ...rest } = t as Anthropic.Tool & {
      cache_control?: unknown;
    };
    return rest as Anthropic.Tool;
  });

  return [
    ...delegatorTools,
    {
      name: "get_assignment_predictor",
      description:
        "Predict round assignment frequency for a validator based on their stake ratio and Monad's ~500ms round time. Returns expected vs actual assignments per hour and 24h, variance %, health signal (normal/below_expected/above_expected), and estimated seconds to next assignment. Use when operator asks about scheduler health, round frequency, or 'when is my next round?'.",
      input_schema: {
        type: "object" as const,
        properties: {
          validator_id: {
            type: "string",
            description: "Validator address (0x...) or moniker",
          },
        },
        required: ["validator_id"],
      },
    },
    {
      name: "get_anomaly_check",
      description:
        "Scan for operational anomalies in a validator's recent activity window. Detects: timeout clusters, success rate drops, streak breaks, VDP status changes, assignment drops, and extended offline periods. Returns ranked anomaly list with severity (low/medium/high) and a summary. Use when operator asks 'anything off?', 'did anything change?', 'what happened?', or similar pattern-detection questions.",
      input_schema: {
        type: "object" as const,
        properties: {
          validator_id: {
            type: "string",
            description: "Validator address (0x...) or moniker",
          },
          window_hours: {
            type: "number",
            description: "Look-back window in hours (default: 24, max: 168)",
          },
        },
        required: ["validator_id"],
      },
      cache_control: { type: "ephemeral" as const },
    },
    {
      name: "get_execution_revenue",
      description:
        "Returns mainnet execution (transaction fee) revenue for a validator over the last 7 days. Reports total 7d and 24h MON earned from block priority fees, daily average, best/worst day, trend direction (up/down/flat), and rank vs network median. Use when the operator asks about 'how much have I earned in fees', 'execution revenue', 'fee revenue', 'mainnet income', 'what did my validator make last week / 24h', or 'am I earning more or less than other validators'. Data is Class 1 — on-chain block fees.",
      input_schema: {
        type: "object" as const,
        properties: {
          validator_identifier: {
            type: "string",
            description: "Validator address (0x...), slug, or moniker",
          },
        },
        required: ["validator_identifier"],
      },
    },
  ];
}

// Execute a tool by name and return serialized JSON.
export async function executeTool(name: string, input: unknown): Promise<string> {
  let result: ToolResult;

  try {
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
      case "estimate_stake_reward":
        result = await estimateStakeRewardTool((input as EstimateStakeRewardInput) ?? {});
        break;
      case "get_recent_assignments":
        result = await getRecentAssignmentsTool(input as GetRecentAssignmentsInput);
        break;
      case "get_network_overview":
        result = await getNetworkOverviewTool();
        break;
      case "get_latest_monad_release":
        result = await getLatestMonadReleaseTool();
        break;
      case "get_assignment_predictor":
        result = await getAssignmentPredictorTool(input as GetAssignmentPredictorInput);
        break;
      case "get_anomaly_check":
        result = await getAnomalyCheckTool((input as GetAnomalyCheckInput) ?? {});
        break;
      case "get_execution_revenue":
        result = await getExecutionRevenueTool(input as GetExecutionRevenueInput);
        break;
      default:
        result = {
          data: { error: `Unknown tool: ${name}` },
          data_class: 1,
          source: name,
          timestamp: new Date().toISOString(),
        };
    }
  } catch (err) {
    console.error(`[iris-agent] tool "${name}" failed:`, err);
    result = {
      data: {
        error: "Data source temporarily unavailable.",
        hint: "Suggest the user try again or rephrase their question.",
      },
      data_class: 1,
      source: name,
      timestamp: new Date().toISOString(),
    };
  }

  return JSON.stringify(result, (_, v) => (typeof v === "bigint" ? v.toString() : v));
}
