import { eq, and, desc, sql } from "drizzle-orm";
import { getDb, validators, epochSnapshots } from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { FindUnderdogsInput, ToolResult } from "./types";

export async function findUnderdogsTool(input: FindUnderdogsInput): Promise<ToolResult> {
  const db = getDb();
  const { min_success_rate = 95, max_stake_rank = 100, limit = 10 } = input;

  // Get all active validators ordered by stake
  const allActive = await db
    .select({
      id: validators.id,
      moniker: validators.moniker,
      slug: validators.slug,
      staked: validators.stakedAmount,
      commission_bps: validators.commissionBps,
      region: validators.region,
    })
    .from(validators)
    .where(and(eq(validators.active, true), eq(validators.jailed, false)))
    .orderBy(desc(validators.stakedAmount));

  // Tag each with stake rank
  const ranked = allActive.map((v, i) => ({ ...v, stake_rank: i + 1 }));

  // Filter to validators outside top-N by stake
  const candidates = ranked.filter((v) => v.stake_rank > max_stake_rank);

  if (candidates.length === 0) {
    return makeResult(
      { count: 0, underdogs: [], note: "No validators found outside the stake rank threshold." },
      { data_class: 2, source: "find_underdogs" }
    );
  }

  // For each candidate, get recent success rate
  const ms30d = 30 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - ms30d);

  const withMetrics = await Promise.all(
    candidates.slice(0, 200).map(async (v) => {
      const snaps = await db
        .select({ successRate: epochSnapshots.successRate })
        .from(epochSnapshots)
        .where(
          and(eq(epochSnapshots.validatorId, v.id), sql`${epochSnapshots.snapshotAt} >= ${cutoff}`)
        )
        .orderBy(desc(epochSnapshots.epoch))
        .limit(30);

      const avg30d =
        snaps.length > 0 ? snaps.reduce((a, s) => a + s.successRate, 0) / snaps.length : null;

      return { ...v, avg_success_rate_30d: avg30d };
    })
  );

  // Filter by min success rate and sort by success rate desc
  const underdogs = withMetrics
    .filter((v) => v.avg_success_rate_30d !== null && v.avg_success_rate_30d >= min_success_rate)
    .sort((a, b) => (b.avg_success_rate_30d ?? 0) - (a.avg_success_rate_30d ?? 0))
    .slice(0, limit)
    .map((v) => ({
      id: v.id,
      moniker: v.moniker,
      slug: v.slug,
      stake_rank: v.stake_rank,
      staked_mon: Number(v.staked) / 1e18,
      commission_pct: v.commission_bps / 100,
      avg_success_rate_30d_pct: v.avg_success_rate_30d,
      region: v.region,
    }));

  return makeResult(
    {
      count: underdogs.length,
      criteria: { min_success_rate_pct: min_success_rate, max_stake_rank },
      underdogs,
      scoring_note: "Ranked by 30-day average success rate (Class 2 derived, formula v1.0)",
    },
    { data_class: 2, source: "find_underdogs" }
  );
}
