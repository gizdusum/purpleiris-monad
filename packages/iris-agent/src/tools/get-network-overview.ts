import { sql, and } from "drizzle-orm";
import {
  getDb,
  validators,
  epochSnapshots,
  getWatchtowerOverview,
} from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { ToolResult } from "./types";

export async function getNetworkOverviewTool(): Promise<ToolResult> {
  const db = getDb();

  const ms30d = 30 * 24 * 60 * 60 * 1000;
  const cutoff30d = new Date(Date.now() - ms30d);

  const [totalValidatorRow, activeValidatorRow, networkAvgRow, wtOverview] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(validators),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(validators)
      .where(and(sql`${validators.active} = true`, sql`${validators.jailed} = false`)),
    db
      .select({
        avg_success_rate: sql<number>`AVG(${epochSnapshots.successRate})`,
        total_proposed: sql<number>`SUM(${epochSnapshots.blocksProposed})`,
        total_missed: sql<number>`SUM(${epochSnapshots.blocksMissed})`,
        epoch_count: sql<number>`COUNT(DISTINCT ${epochSnapshots.epoch})`,
      })
      .from(epochSnapshots)
      .where(
        and(
          sql`${epochSnapshots.snapshotAt} > ${cutoff30d}`,
          sql`${epochSnapshots.scheduledDowntime} = false`
        )
      ),
    getWatchtowerOverview().catch(() => null),
  ]);

  const totalValidators = Number(totalValidatorRow[0]?.count ?? 0);
  const activeValidators = Number(activeValidatorRow[0]?.count ?? 0);
  const avg30d = networkAvgRow[0]?.avg_success_rate ?? null;
  const totalProposed30d = Number(networkAvgRow[0]?.total_proposed ?? 0);
  const totalMissed30d = Number(networkAvgRow[0]?.total_missed ?? 0);
  const epochsObserved30d = Number(networkAvgRow[0]?.epoch_count ?? 0);

  // Top 10 by uptime from Watchtower
  const wtValidators = wtOverview?.validators ?? [];
  const top10 = [...wtValidators]
    .sort((a, b) => b.uptime_percentage - a.uptime_percentage)
    .slice(0, 10)
    .map((v) => ({
      name: v.name,
      uptime_pct: v.uptime_percentage,
      blocks_proposed: v.blocks_proposed,
      blocks_skipped: v.blocks_skipped,
      alert_level: v.alert_level,
      is_down: v.is_down,
    }));

  // Watchtower global stats
  const globalStats = wtOverview?.global_stats ?? null;
  const currentEpoch = wtOverview?.current_epoch ?? null;
  const currentEpochStartedAt = wtOverview?.current_epoch_started_at ?? null;
  const trackingWindowHours = wtOverview?.tracking_window_hours ?? null;
  const wtLastUpdated = wtOverview?.last_updated ?? null;

  // Count alert levels
  const alertCounts = { ok: 0, warning: 0, critical: 0 };
  for (const v of wtValidators) {
    if (v.alert_level === 0) alertCounts.ok++;
    else if (v.alert_level === 1) alertCounts.warning++;
    else alertCounts.critical++;
  }

  const downCount = wtValidators.filter((v) => v.is_down).length;

  return makeResult(
    {
      // ── Validator counts (Class 1) ──────────────────────────────────────
      total_validators: totalValidators,
      active_validators: activeValidators,

      // ── Watchtower live snapshot (Class 1) ─────────────────────────────
      watchtower_last_updated: wtLastUpdated,
      current_epoch: currentEpoch,
      current_epoch_started_at: currentEpochStartedAt,
      tracking_window_hours: trackingWindowHours,
      watchtower_active_validators: globalStats?.active_validators ?? null,
      network_uptime_pct: globalStats?.network_uptime ?? null,
      lifetime_total_proposed: globalStats?.total_proposed ?? null,
      lifetime_total_skipped: globalStats?.total_skipped ?? null,
      validators_down_now: downCount,
      alert_distribution: alertCounts,

      // ── 30-day rolling aggregates (Class 2) ────────────────────────────
      thirty_day_avg_success_rate: avg30d,
      thirty_day_total_blocks_proposed: totalProposed30d,
      thirty_day_total_blocks_missed: totalMissed30d,
      thirty_day_epochs_observed: epochsObserved30d,

      // ── Top performers (Class 1 — from Watchtower) ─────────────────────
      top_validators_by_uptime: top10,
    },
    { data_class: 2, source: "get_network_overview" }
  );
}
