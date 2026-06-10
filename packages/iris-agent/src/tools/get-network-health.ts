import { eq, count, sql } from "drizzle-orm";
import { getDb, validators, getWatchtowerOverview } from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { ToolResult } from "./types";

function computeNakamoto(stakedAmounts: bigint[]): number {
  const sorted = [...stakedAmounts].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  const total = sorted.reduce((a, b) => a + b, 0n);
  const threshold = total / 3n;
  let cum = 0n;
  for (let i = 0; i < sorted.length; i++) {
    cum += sorted[i]!;
    if (cum > threshold) return i + 1;
  }
  return sorted.length;
}

export async function getNetworkHealthTool(): Promise<ToolResult> {
  const db = getDb();

  const [dbStats, watchtower] = await Promise.allSettled([
    db
      .select({
        total: count(),
        active: sql<number>`sum(case when ${validators.active} = true and ${validators.jailed} = false then 1 else 0 end)`,
        jailed: sql<number>`sum(case when ${validators.jailed} = true then 1 else 0 end)`,
        totalStake: sql<bigint>`sum(${validators.stakedAmount})`,
      })
      .from(validators)
      .then((r) => r[0]),
    getWatchtowerOverview(),
  ]);

  const db_result = dbStats.status === "fulfilled" ? dbStats.value : null;
  const wt = watchtower.status === "fulfilled" ? watchtower.value : null;

  // Nakamoto coefficient from staked amounts
  const stakeRows = await db
    .select({ staked: validators.stakedAmount })
    .from(validators)
    .where(eq(validators.active, true));
  const nakamoto = computeNakamoto(stakeRows.map((r) => BigInt(r.staked)));

  const networkUptime = wt?.global_stats?.network_uptime ?? null;
  const successRate = networkUptime;

  return makeResult(
    {
      // Class 1 fields — on-chain
      total_validators: db_result?.total ?? null,
      active_validators: db_result?.active ?? wt?.global_stats?.active_validators ?? null,
      jailed_validators: db_result?.jailed ?? null,
      total_staked_mon: db_result?.totalStake ? Number(db_result.totalStake) / 1e18 : null,

      // Class 2 — block-weighted derived ratio (NOT the deviation baseline)
      network_success_rate_pct: successRate,
      network_success_rate_note:
        "Block-weighted (Watchtower total_proposed/total_blocks across tracking window). NOT the deviation baseline — use thirty_day_deviation_from_network_pp from get_validator for validator-vs-network comparison.",
      network_success_rate_data_class: 2,
      current_epoch: wt?.current_epoch ?? null,
      last_updated: wt?.last_updated ?? null,

      // Class 2 — derived by formula
      nakamoto_coefficient: {
        value: nakamoto,
        interpretation: `Minimum ${nakamoto} validators control >33% of stake`,
        data_class: 2,
        formula: "nakamoto_coefficient v1.0 (see /methodology)",
      },
    },
    { data_class: 1, source: "get_network_health" }
  );
}
