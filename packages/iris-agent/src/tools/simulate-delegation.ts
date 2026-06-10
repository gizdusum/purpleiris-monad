import { eq, desc, sql, and } from "drizzle-orm";
import { getDb, validators, epochSnapshots } from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { SimulateDelegationInput, ToolResult } from "./types";
import { resolveValidatorByName } from "./lib/resolve-validator";

const MAINNET_BASELINE_APR = 0.08;

export async function simulateDelegationTool({
  validator_id,
  stake_mon,
  days,
}: SimulateDelegationInput): Promise<ToolResult> {
  const db = getDb();

  // Resolve validator identity — same path as get-validator
  const isAddr = validator_id.toLowerCase().startsWith("0x");
  let resolvedId: string;
  let resolutionNote: string | null = null;

  if (isAddr) {
    const rows = await db
      .select({ id: validators.id })
      .from(validators)
      .where(eq(validators.id, validator_id.toLowerCase()))
      .limit(1);
    if (!rows[0]) {
      return makeResult(
        { error: `Validator not found: ${validator_id}`, not_found: true },
        { data_class: 3, source: "simulate_delegation" }
      );
    }
    resolvedId = rows[0].id;
  } else {
    const resolved = await resolveValidatorByName(validator_id);
    if (resolved.kind === "not_found") {
      return makeResult(
        { error: `Validator not found: ${validator_id}`, not_found: true },
        { data_class: 3, source: "simulate_delegation" }
      );
    }
    if (resolved.kind === "candidates") {
      return makeResult(
        { candidate_matches: resolved.candidates, resolution_note: null },
        { data_class: 3, source: "simulate_delegation" }
      );
    }
    resolvedId = resolved.id;
    resolutionNote = resolved.resolutionNote;
  }

  const validator = await db
    .select({
      id: validators.id,
      moniker: validators.moniker,
      commissionBps: validators.commissionBps,
    })
    .from(validators)
    .where(eq(validators.id, resolvedId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!validator) {
    return makeResult(
      { error: `Validator not found: ${validator_id}`, not_found: true },
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
      ? snapshots.reduce((a, s) => a + s.successRate, 0) / snapshots.length
      : 0.99;

  const commissionRate = validator.commissionBps / 10000;

  // Estimate reward: APR baseline × commission × historical success rate
  const totalEstimatedReward =
    stake_mon * MAINNET_BASELINE_APR * (days / 365) * (1 - commissionRate) * avgSuccessRate;

  // Variance from success rate std dev
  const successRates = snapshots.map((s) => s.successRate);
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
      resolution_note: resolutionNote,
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
        commission_pct: Math.round(commissionRate * 1000) / 10,
        known_weakness:
          "Reward estimate uses 8% p.a. baseline APR, adjusted for this validator's commission and historical success rate. Actual rewards depend on network participation rate, reward schedule updates, and staking conditions.",
      },
    },
    { data_class: 3, source: "simulate_delegation" }
  );
}
