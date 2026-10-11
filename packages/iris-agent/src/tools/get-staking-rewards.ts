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

  // ── Pool rewards from the validators table ───────────────────────────────
  // getValidator().unclaimedRewards is the pool of rewards owed to ALL of the
  // validator's delegators, not the operator's commission. Commission is
  // credited to the auth address as a delegator; get_validator_onchain reads it.
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

  const poolUnclaimedMon = weiToMon(valRow?.unclaimedRewardsWei ?? null);
  const commissionRatePct = (valRow?.commissionBps ?? 0) / 100;
  const stakeMon = weiToMon(valRow?.stakedAmount ?? null);

  // ── Tier 2: daily aggregate from validator_staking_rewards ────────────────
  // One row per validator per UTC calendar day. Querying last 7 days (today + 6 prior).
  const todayUtc = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const sevenDaysAgoDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [agg7d] = await db
    .select({
      total: sql<string>`COALESCE(SUM(commission_earned_wei::numeric), 0)`,
      day_count: sql<string>`COUNT(*)`,
    })
    .from(validatorStakingRewards)
    .where(
      sql`${validatorStakingRewards.validatorAuthAddress} = ${validatorId}
        AND ${validatorStakingRewards.day} >= ${sevenDaysAgoDate}`
    );

  const [todayRow] = await db
    .select({
      total: sql<string>`COALESCE(commission_earned_wei::numeric::text, '0')`,
    })
    .from(validatorStakingRewards)
    .where(
      sql`${validatorStakingRewards.validatorAuthAddress} = ${validatorId}
        AND ${validatorStakingRewards.day} = ${todayUtc}`
    );

  const total7dMon = weiToMon(agg7d?.total ?? "0");
  const todayMon = weiToMon(todayRow?.total ?? "0");
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
      // Pool (indexed)
      pool_unclaimed_rewards_mon: Math.round(poolUnclaimedMon * 1e6) / 1e6,
      pool_unclaimed_rewards_note:
        "Unclaimed rewards held in this validator's pool for all of its delegators, as last indexed. This is NOT the operator's commission. For what the operator can claim now, call get_validator_onchain and read operator.claimable_rewards_mon.",
      commission_rate_pct: commissionRatePct,
      stake_mon: Math.round(stakeMon * 1e4) / 1e4,
      pool_indexed_at: valRow?.updatedAt?.toISOString() ?? null,
      // Tier 2 (daily aggregate)
      total_7d_commission_mon: Math.round(total7dMon * 1e6) / 1e6,
      today_commission_mon: Math.round(todayMon * 1e6) / 1e6,
      today_data_complete: false,
      today_commission_note:
        "Intraday accumulation for current UTC calendar day only — partial until UTC midnight. Indexer syncs hourly; value grows through the day. Do not compare to avg_per_day_mon as a trend signal.",
      avg_per_day_mon: Math.round(avgPerDayMon * 1e6) / 1e6,
      estimated_monthly_mon:
        estimatedMonthlyMon !== null ? Math.round(estimatedMonthlyMon * 1e2) / 1e2 : null,
      window_days: dayCount,
      data_complete: dataComplete,
      has_historical_data: hasHistoricalData,
    },
    { data_class: dataComplete ? 1 : hasHistoricalData ? 2 : 3, source: "get_staking_rewards" }
  );
}
