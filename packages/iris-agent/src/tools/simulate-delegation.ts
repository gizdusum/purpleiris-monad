import { eq, desc, sql, and } from "drizzle-orm";
import { getDb, validators, epochSnapshots } from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { SimulateDelegationInput, ToolResult } from "./types";

const EPOCHS_PER_DAY = (24 * 60 * 60 * 1000) / (5.5 * 60 * 60 * 1000); // ~4.36 epochs/day
const TOTAL_NETWORK_REWARDS_PER_EPOCH_MON = 5000; // approximate; Phase 9 will derive from chain

export async function simulateDelegationTool({
  validator_id,
  stake_mon,
  days,
}: SimulateDelegationInput): Promise<ToolResult> {
  const db = getDb();

  const validator = await db
    .select({
      id: validators.id,
      moniker: validators.moniker,
      stakedAmount: validators.stakedAmount,
    })
    .from(validators)
    .where(
      validator_id.toLowerCase().startsWith("0x")
        ? eq(validators.id, validator_id.toLowerCase())
        : eq(validators.slug, validator_id)
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!validator) {
    return makeResult(
      { error: `Validator not found: ${validator_id}` },
      { data_class: 3, source: "simulate_delegation" }
    );
  }

  // Get last 30 days of epoch snapshots for historical success rate
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const snapshots = await db
    .select({
      successRate: epochSnapshots.successRate,
      blocksProposed: epochSnapshots.blocksProposed,
    })
    .from(epochSnapshots)
    .where(
      and(
        eq(epochSnapshots.validatorId, validator.id),
        sql`${epochSnapshots.snapshotAt} >= ${cutoff}`
      )
    )
    .orderBy(desc(epochSnapshots.epoch))
    .limit(130);

  const avgSuccessRate =
    snapshots.length > 0
      ? snapshots.reduce((a, s) => a + s.successRate, 0) / snapshots.length / 100
      : 0.99;

  const validatorTotalStake = Number(validator.stakedAmount) / 1e18;
  const userStakeShare = stake_mon / (validatorTotalStake + stake_mon);

  // Estimate APY range (±variance)
  const epochsTotal = days * EPOCHS_PER_DAY;
  const baseRewardPerEpoch = TOTAL_NETWORK_REWARDS_PER_EPOCH_MON * userStakeShare * avgSuccessRate;
  const totalEstimatedReward = baseRewardPerEpoch * epochsTotal;

  // Variance from success rate std dev
  const successRates = snapshots.map((s) => s.successRate / 100);
  const variance =
    successRates.length > 1
      ? successRates.reduce((a, r) => a + (r - avgSuccessRate) ** 2, 0) / (successRates.length - 1)
      : 0.001;
  const stdDev = Math.sqrt(variance);

  const rewardLow = totalEstimatedReward * (1 - stdDev * 2);
  const rewardHigh = totalEstimatedReward * (1 + stdDev * 2);

  const apyBase = (totalEstimatedReward / stake_mon) * (365 / days) * 100;
  const apyLow = (rewardLow / stake_mon) * (365 / days) * 100;
  const apyHigh = (rewardHigh / stake_mon) * (365 / days) * 100;

  return makeResult(
    {
      validator_id: validator.id,
      validator_moniker: validator.moniker,
      stake_mon,
      days,
      estimated_reward_mon: {
        base: Math.round(totalEstimatedReward * 1000) / 1000,
        low: Math.round(rewardLow * 1000) / 1000,
        high: Math.round(rewardHigh * 1000) / 1000,
      },
      estimated_apy_pct: {
        base: Math.round(apyBase * 10) / 10,
        low: Math.round(apyLow * 10) / 10,
        high: Math.round(apyHigh * 10) / 10,
      },
      assumptions: {
        historical_epochs_used: snapshots.length,
        avg_success_rate_pct: Math.round(avgSuccessRate * 1000) / 10,
        approximate_network_reward_per_epoch_mon: TOTAL_NETWORK_REWARDS_PER_EPOCH_MON,
        known_weakness:
          "Network reward rate is approximated. Actual rewards depend on total network participation, validator commission changes, and slashing events. Phase 9 will derive this from on-chain data.",
      },
    },
    { data_class: 3, source: "simulate_delegation" }
  );
}
