import { makeResult } from "./types";
import type { EstimateStakeRewardInput, ToolResult } from "./types";

const MAINNET_BASELINE_APR = 0.08;

export async function estimateStakeRewardTool({
  stake_mon,
  days,
  commission_bps = 500,
}: EstimateStakeRewardInput): Promise<ToolResult> {
  const commission = commission_bps / 10000;
  const netApr = MAINNET_BASELINE_APR * (1 - commission);

  const baseReward = stake_mon * netApr * (days / 365);
  const lowReward = baseReward * 0.8;
  const highReward = baseReward * 1.2;

  const baseAprPct = netApr * 100;

  return makeResult(
    {
      stake_mon,
      days,
      commission_bps,
      net_apr_pct: {
        base: Math.round(baseAprPct * 10) / 10,
        low: Math.round(baseAprPct * 0.8 * 10) / 10,
        high: Math.round(baseAprPct * 1.2 * 10) / 10,
      },
      estimated_reward_mon: {
        base: Math.round(baseReward * 1000) / 1000,
        low: Math.round(lowReward * 1000) / 1000,
        high: Math.round(highReward * 1000) / 1000,
      },
      assumptions: {
        baseline_apr_pct: MAINNET_BASELINE_APR * 100,
        known_weakness:
          "Baseline APR is a fixed estimate (8% p.a.). Actual rewards depend on network participation rate, validator uptime, commission changes, and staking reward schedule updates. Use simulate_delegation for a projection adjusted to a specific validator's commission and historical success rate.",
      },
    },
    { data_class: 3, source: "estimate_stake_reward" }
  );
}
