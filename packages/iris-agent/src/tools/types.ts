import type { DataClass } from "@purpleiris/shared-types";

/**
 * How old the indexed (database-backed) data behind a tool result is.
 * Attached by executeTool to every tool that reads the indexer's tables.
 */
export type ToolFreshness = {
  /** ISO-8601 time of the indexer's last successful validator sync, or null if unknown. */
  indexed_at: string | null;
  age_hours: number | null;
  /** True when the index is older than 1.5 indexer cycles, or its age is unknown. */
  stale: boolean;
  note?: string;
};

export type ToolResult = {
  data: unknown;
  data_class: DataClass;
  source: string;
  timestamp: string;
  freshness?: ToolFreshness;
};

export function makeResult<T>(
  data: T,
  opts: { data_class: DataClass; source: string }
): ToolResult {
  return {
    data,
    data_class: opts.data_class,
    source: opts.source,
    timestamp: new Date().toISOString(),
  };
}

// Input types for each delegator tool
export type GetValidatorInput = { id: string };

export type ListValidatorsInput = {
  active_only?: boolean;
  max_commission_bps?: number;
  min_stake_mon?: number;
  region?: string;
  infra_provider?: string;
  limit?: number;
};

export type GetNetworkHealthInput = Record<string, never>;

export type FindUnderdogsInput = {
  min_success_rate?: number;
  max_stake_rank?: number;
  limit?: number;
};

export type SimulateDelegationInput = {
  validator_id: string;
  stake_mon: number;
  days: number;
};

export type SimulateDiversificationInput = {
  allocations: { validator_id: string; stake_mon: number }[];
};

export type EstimateStakeRewardInput = {
  stake_mon: number;
  days: number;
  commission_bps?: number;
};

export type GetRecentAssignmentsInput = {
  validator_id: string;
  limit?: number;
};

export type GetNetworkOverviewInput = Record<string, never>;

export type GetAssignmentPredictorInput = {
  validator_id: string;
};

export type GetAnomalyCheckInput = {
  validator_id: string;
  window_hours?: number;
};

export type GetExecutionRevenueInput = {
  validator_identifier: string;
};

export type GetStakingRewardsInput = {
  validator_identifier: string;
};

export type GetOnchainSnapshotInput = {
  top_n?: number;
};
