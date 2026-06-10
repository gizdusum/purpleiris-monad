import { eq, sql } from "drizzle-orm";
import {
  getDb,
  validators,
  validatorMetadata,
  getWatchtowerOverview,
} from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { ToolResult } from "./types";

export type GetAssignmentPredictorInput = { validator_id: string };

// Monad BFT has ~500ms per round (network constant)
const MONAD_ROUND_MS = 500;

export async function getAssignmentPredictorTool({
  validator_id,
}: GetAssignmentPredictorInput): Promise<ToolResult> {
  const db = getDb();
  const isAddr = validator_id.toLowerCase().startsWith("0x");
  const idLower = validator_id.toLowerCase();

  const joinCond = sql`${validators.secpPubkey} IS NOT NULL AND ${validators.secpPubkey} = ${validatorMetadata.pubkey}`;

  const rows = await db
    .select({
      id: validators.id,
      moniker: validators.moniker,
      meta_moniker: validatorMetadata.moniker,
      slug: validators.slug,
      stakedAmount: validators.stakedAmount,
      secpPubkey: validators.secpPubkey,
    })
    .from(validators)
    .leftJoin(validatorMetadata, joinCond)
    .where(
      isAddr
        ? eq(validators.id, idLower)
        : sql`LOWER(${validators.slug}) = ${idLower}
            OR LOWER(${validators.moniker}) = ${idLower}
            OR LOWER(${validatorMetadata.moniker}) = ${idLower}`
    )
    .limit(1);

  const row = rows[0] ?? null;
  if (!row) {
    return makeResult(
      { error: `Validator not found: ${validator_id}`, not_found: true },
      { data_class: 2, source: "get_assignment_predictor" }
    );
  }

  const [networkStakeRow, wtOverview] = await Promise.all([
    db
      .select({ total: sql<string>`SUM(${validators.stakedAmount})` })
      .from(validators)
      .where(eq(validators.active, true)),
    getWatchtowerOverview().catch(() => null),
  ]);

  const totalNetworkStake = BigInt(networkStakeRow[0]?.total ?? "0");
  const validatorStake = BigInt(row.stakedAmount);
  const stakeRatio =
    totalNetworkStake > 0n ? Number(validatorStake) / Number(totalNetworkStake) : 0;

  const wtEntry = row.secpPubkey
    ? (wtOverview?.validators.find((v) => v.node_id.slice(2).toLowerCase() === row.secpPubkey) ??
      null)
    : null;

  // Expected assignments from stake ratio and Monad round time
  const roundsPerHour = 3_600_000 / MONAD_ROUND_MS;
  const expectedPerHour = roundsPerHour * stakeRatio;
  const expectedPer24h = expectedPerHour * 24;

  // Actual last 24h — Watchtower continuous count only; epoch-sum structurally undercounts
  const watchtowerDown = wtEntry === null;
  const actualPer24h: number | null = wtEntry?.blocks_proposed ?? null;

  // Actual last hour: current epoch data from Watchtower
  let actualPerHour: number | null = null;
  if (wtEntry && wtOverview?.current_epoch_started_at) {
    const epochAgeMs = Date.now() - new Date(wtOverview.current_epoch_started_at).getTime();
    actualPerHour =
      epochAgeMs <= 60 * 60 * 1000
        ? wtEntry.current_epoch_finalized
        : Math.round(wtEntry.current_epoch_finalized * ((60 * 60 * 1000) / epochAgeMs));
  }

  // Variance only valid when Watchtower is available
  const variancePct: number | null =
    !watchtowerDown && actualPer24h !== null && expectedPer24h > 0
      ? ((actualPer24h - expectedPer24h) / expectedPer24h) * 100
      : null;

  const healthSignal: "normal" | "below_expected" | "above_expected" | "unavailable" =
    watchtowerDown
      ? "unavailable"
      : variancePct! < -25
        ? "below_expected"
        : variancePct! > 25
          ? "above_expected"
          : "normal";

  const nextEstimatedSec =
    stakeRatio > 0 ? Math.round((1 / stakeRatio) * (MONAD_ROUND_MS / 1000)) : null;

  return makeResult(
    {
      fetched_at: new Date().toISOString(),
      validator_id: row.id,
      validator_moniker: row.meta_moniker ?? row.moniker,
      stake_ratio: Math.round(stakeRatio * 100000) / 100000,
      avg_round_duration_ms: MONAD_ROUND_MS,
      expected_assignments_per_hour: Math.round(expectedPerHour * 10) / 10,
      expected_assignments_per_24h: Math.round(expectedPer24h),
      actual_assignments_last_hour: actualPerHour,
      actual_assignments_last_24h: actualPer24h,
      variance_vs_expected_pct: variancePct !== null ? Math.round(variancePct * 10) / 10 : null,
      next_estimated_assignment_seconds: nextEstimatedSec,
      health_signal: healthSignal,
      variance_note: watchtowerDown
        ? "Real-time assignment data needs Watchtower (currently unavailable) — variance not computed."
        : null,
      data_note:
        "Class 2 — derived from on-chain stake ratio and Watchtower continuous block tracking. Hour-level estimates from current epoch Watchtower data.",
    },
    { data_class: 2, source: "get_assignment_predictor" }
  );
}
