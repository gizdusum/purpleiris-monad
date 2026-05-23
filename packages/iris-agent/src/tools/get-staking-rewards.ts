import { eq, sql } from "drizzle-orm";
import { getDb, validators, validatorStakingRewards } from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { GetStakingRewardsInput, ToolResult } from "./types";
import { resolveValidatorByName } from "./lib/resolve-validator";

const WEI_PER_MON = 1_000_000_000_000_000_000n;

function weiToMon(wei: string | null | undefined): number {
  if (!wei) return 0;
  const w = BigInt(wei);
  const whole = w / WEI_PER_MON;
  const frac = Number(w - whole * WEI_PER_MON) / 1e18;
  return Number(whole) + frac;
}

async function resolveValidatorId(
  identifier: string
): Promise<{ validatorId: string; moniker: string } | null> {
  const db = getDb();

  if (identifier.toLowerCase().startsWith("0x")) {
    const rows = await db
      .select({ id: validators.id, moniker: validators.moniker })
      .from(validators)
      .where(eq(validators.id, identifier.toLowerCase()))
      .limit(1);
    const r = rows[0];
    return r ? { validatorId: r.id, moniker: r.moniker } : null;
  }

  const result = await resolveValidatorByName(identifier);
  if (result.kind === "found") {
    return { validatorId: result.id, moniker: result.moniker };
  }
  return null;
}

export async function getStakingRewardsTool({
  validator_identifier,
}: GetStakingRewardsInput): Promise<ToolResult> {
  const db = getDb();

  const resolved = await resolveValidatorId(validator_identifier);
  if (!resolved) {
    return makeResult(
      { error: `Validator not found: ${validator_identifier}`, not_found: true },
      { data_class: 1, source: "get_staking_rewards" }
    );
  }

  const { validatorId, moniker } = resolved;

  // ── Tier 1: live pending commission from validators table ─────────────────
  const [valRow] = await db
    .select({
      unclaimedRewardsWei: validators.unclaimedRewardsWei,
      commissionBps: validators.commissionBps,
      stakedAmount: validators.stakedAmount,
      updatedAt: validators.updatedAt,
    })
    .from(validators)
    .where(eq(validators.id, validatorId))
    .limit(1);

  const pendingCommissionMon = weiToMon(valRow?.unclaimedRewardsWei ?? null);
  const commissionRatePct = (valRow?.commissionBps ?? 0) / 100;
  const stakeMon = weiToMon(valRow?.stakedAmount ?? null);

  // ── Tier 2: cumulative history from validator_staking_rewards ─────────────
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [agg7d] = await db
    .select({
      total: sql<string>`COALESCE(SUM(commission_earned_wei::numeric), 0)`,
      day_count: sql<string>`COUNT(DISTINCT DATE_TRUNC('day', block_timestamp))`,
    })
    .from(validatorStakingRewards)
    .where(
      sql`${validatorStakingRewards.validatorAuthAddress} = ${validatorId}
        AND ${validatorStakingRewards.blockTimestamp} >= ${sevenDaysAgo}`
    );

  const [agg24h] = await db
    .select({
      total: sql<string>`COALESCE(SUM(commission_earned_wei::numeric), 0)`,
    })
    .from(validatorStakingRewards)
    .where(
      sql`${validatorStakingRewards.validatorAuthAddress} = ${validatorId}
        AND ${validatorStakingRewards.blockTimestamp} >= ${oneDayAgo}`
    );

  const total7dMon = weiToMon(agg7d?.total ?? "0");
  const total24hMon = weiToMon(agg24h?.total ?? "0");
  const dayCount = Number(agg7d?.day_count ?? 0);
  const avgPerDayMon = dayCount > 0 ? total7dMon / dayCount : 0;

  // Class 3 monthly estimate: 30-day linear extrapolation from 7d average
  const estimatedMonthlyMon = avgPerDayMon > 0 ? avgPerDayMon * 30 : null;

  const dataComplete = dayCount >= 7;
  const hasHistoricalData = total7dMon > 0;

  return makeResult(
    {
      validator_id: validatorId,
      moniker,
      // Tier 1
      pending_commission_mon: Math.round(pendingCommissionMon * 1e6) / 1e6,
      commission_rate_pct: commissionRatePct,
      stake_mon: Math.round(stakeMon * 1e4) / 1e4,
      tier1_updated_at: valRow?.updatedAt?.toISOString() ?? null,
      // Tier 2
      total_7d_commission_mon: Math.round(total7dMon * 1e6) / 1e6,
      total_24h_commission_mon: Math.round(total24hMon * 1e6) / 1e6,
      avg_per_day_mon: Math.round(avgPerDayMon * 1e6) / 1e6,
      estimated_monthly_mon:
        estimatedMonthlyMon !== null ? Math.round(estimatedMonthlyMon * 1e2) / 1e2 : null,
      window_days: dayCount,
      data_complete: dataComplete,
      has_historical_data: hasHistoricalData,
      data_class: dataComplete ? 1 : hasHistoricalData ? 2 : 3,
    },
    { data_class: 1, source: "get_staking_rewards" }
  );
}
