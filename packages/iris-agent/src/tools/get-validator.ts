import { eq, desc, sql, and } from "drizzle-orm";
import {
  getDb,
  validators,
  epochSnapshots,
  validatorMetadata,
  getWatchtowerOverview,
} from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { GetValidatorInput, ToolResult } from "./types";
import type { WatchtowerValidator } from "@purpleiris/shared-types";

function onlineStatus(wt: WatchtowerValidator | null): "online" | "degraded" | "offline" {
  if (!wt || wt.is_down) return "offline";
  const ageMs = Date.now() - new Date(wt.last_seen).getTime();
  if (ageMs < 5 * 60 * 1000) return "online";
  if (ageMs < 30 * 60 * 1000) return "degraded";
  return "offline";
}

export async function getValidatorTool({ id }: GetValidatorInput): Promise<ToolResult> {
  const db = getDb();
  const addr = id.toLowerCase().startsWith("0x") ? id.toLowerCase() : null;

  const rows = await db
    .select({
      id: validators.id,
      moniker: validators.moniker,
      meta_moniker: validatorMetadata.moniker,
      logo_url: validatorMetadata.logoUrl,
      meta_website: validatorMetadata.website,
      description: validatorMetadata.description,
      slug: validators.slug,
      website: validators.website,
      commissionBps: validators.commissionBps,
      jailed: validators.jailed,
      active: validators.active,
      stakedAmount: validators.stakedAmount,
      region: validators.region,
      infraProvider: validators.infraProvider,
      secpPubkey: validators.secpPubkey,
    })
    .from(validators)
    .leftJoin(
      validatorMetadata,
      sql`${validators.secpPubkey} IS NOT NULL AND ${validators.secpPubkey} = ${validatorMetadata.pubkey}`
    )
    .where(addr ? eq(validators.id, addr) : eq(validators.slug, id))
    .limit(1);

  const row = rows[0] ?? null;
  if (!row) {
    return makeResult(
      { error: `Validator not found: ${id}` },
      { data_class: 1, source: "get_validator" }
    );
  }

  const ms30d = 30 * 24 * 60 * 60 * 1000;
  const ms24h = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const cutoff30d = new Date(now - ms30d);

  // Fetch epoch snapshots + network 30d avg + earliest snapshot in parallel
  const [snapshots, networkAvgRow, earliestSnap, wtOverview] = await Promise.all([
    db
      .select()
      .from(epochSnapshots)
      .where(eq(epochSnapshots.validatorId, row.id))
      .orderBy(desc(epochSnapshots.epoch))
      .limit(500),
    db
      .select({ avg: sql<number>`AVG(${epochSnapshots.successRate})` })
      .from(epochSnapshots)
      .where(
        and(
          sql`${epochSnapshots.snapshotAt} > ${cutoff30d}`,
          eq(epochSnapshots.scheduledDowntime, false)
        )
      ),
    db
      .select({ epoch: epochSnapshots.epoch, snapshotAt: epochSnapshots.snapshotAt })
      .from(epochSnapshots)
      .where(eq(epochSnapshots.validatorId, row.id))
      .orderBy(epochSnapshots.epoch)
      .limit(1),
    getWatchtowerOverview().catch(() => null),
  ]);

  // Match watchtower entry by secp pubkey
  const wtEntry: WatchtowerValidator | null = row.secpPubkey
    ? (wtOverview?.validators.find((v) => v.node_id.slice(2).toLowerCase() === row.secpPubkey) ??
      null)
    : null;

  // ── Derived: epoch snapshot aggregates ───────────────────────────────────
  const snaps30d = snapshots.filter(
    (s) => s.snapshotAt.getTime() > now - ms30d && !s.scheduledDowntime
  );
  const snaps24h = snapshots.filter(
    (s) => s.snapshotAt.getTime() > now - ms24h && !s.scheduledDowntime
  );

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  const networkAvg30d = networkAvgRow[0]?.avg ?? null;
  const thisAvg30d = avg(snaps30d.map((s) => s.successRate));
  const deviation30d =
    thisAvg30d !== null && networkAvg30d !== null ? thisAvg30d - networkAvg30d : null;

  const totalFinalized = snapshots.reduce((a, s) => a + s.blocksProposed, 0);
  const totalTimeouts = snapshots.reduce((a, s) => a + s.blocksMissed, 0);

  // ── Hourly activity (epoch-granularity grouped by UTC hour) ──────────────
  const hourlyMap = new Map<number, { finalized: number; timeouts: number }>();
  for (let h = 0; h < 24; h++) hourlyMap.set(h, { finalized: 0, timeouts: 0 });
  for (const s of snaps24h) {
    const h = s.snapshotAt.getUTCHours();
    const entry = hourlyMap.get(h)!;
    entry.finalized += s.blocksProposed;
    entry.timeouts += s.blocksMissed;
  }
  const hourly_activity_24h = Array.from({ length: 24 }, (_, h) => ({
    hour_utc: h,
    ...hourlyMap.get(h)!,
  }));

  const nonzeroHours = hourly_activity_24h.filter((e) => e.finalized + e.timeouts > 0);
  const peakEntry = nonzeroHours.reduce((best, e) => (e.finalized > best.finalized ? e : best), {
    hour_utc: 0,
    finalized: 0,
    timeouts: 0,
  });
  const troughEntry = nonzeroHours.reduce(
    (worst, e) => (e.finalized < worst.finalized ? e : worst),
    peakEntry
  );

  // ── Watchtower-derived fields ─────────────────────────────────────────────
  const wt = wtEntry;
  const lastSeenSec = wt
    ? Math.floor((Date.now() - new Date(wt.last_seen).getTime()) / 1000)
    : null;

  return makeResult(
    {
      // ── Identity (Class 1) ──────────────────────────────────────────────
      id: row.id,
      moniker: row.meta_moniker ?? row.moniker,
      logo_url: row.logo_url ?? null,
      description: row.description ?? null,
      slug: row.slug,
      website: row.meta_website ?? row.website,
      commission_bps: row.commissionBps,
      commission_pct: row.commissionBps / 100,
      jailed: row.jailed,
      active: row.active,
      staked_amount_mon: Number(row.stakedAmount) / 1e18,
      region: row.region,
      infra_provider: row.infraProvider,

      // ── Status (Class 2 — derived heuristic from last_seen) ────────────
      online_status: onlineStatus(wt),
      last_seen_at: wt?.last_seen ?? null,
      last_round_seconds_ago: lastSeenSec,

      // ── Live round data (Class 1 — from Watchtower) ────────────────────
      last_block_round: wt?.last_block_round ?? null,
      consecutive_finalized_blocks: wt?.consecutive_proposed ?? null,
      consecutive_skipped_blocks: wt?.consecutive_skipped ?? null,

      // ── Current epoch (Class 1 — from Watchtower) ──────────────────────
      current_epoch_finalized: wt?.current_epoch_finalized ?? null,
      current_epoch_timeouts: wt?.current_epoch_skipped ?? null,
      current_epoch_success_rate: wt != null ? wt.current_epoch_success_rate / 100 : null,

      // ── 30-day rolling (Class 2 — derived from epoch snapshots) ────────
      thirty_day_rolling_success_rate: thisAvg30d,
      thirty_day_deviation_from_network: deviation30d,

      // ── Active since (Class 1 — earliest epoch snapshot) ───────────────
      active_since_epoch: earliestSnap[0]?.epoch ?? null,
      active_since_timestamp: earliestSnap[0]?.snapshotAt.toISOString() ?? null,
      epochs_observed: wt?.epochs_observed ?? snapshots.length,

      // ── Hourly activity (Class 2 — epoch snapshots grouped by hour) ────
      hourly_activity_24h_note:
        "Epoch-granularity data grouped into hourly buckets (~5.5h per epoch).",
      hourly_activity_24h,
      hourly_pattern_summary:
        nonzeroHours.length > 0
          ? {
              peak_hour_utc: peakEntry.hour_utc,
              peak_count: peakEntry.finalized,
              trough_hour_utc: troughEntry.hour_utc,
              trough_count: troughEntry.finalized,
            }
          : null,

      // ── Lifetime totals (Class 1 — sum of all epoch snapshots) ─────────
      total_blocks_finalized: wt?.blocks_proposed ?? totalFinalized,
      total_timeouts: wt?.blocks_skipped ?? totalTimeouts,
      total_uptime_pct: wt?.uptime_percentage ?? null,

      // ── VDP / trust signals (Class 1 — from Watchtower) ────────────────
      vdp_flagged_weeks: wt?.vdp_flagged_weeks ?? null,
      vdp_weeks_analyzed: wt?.vdp_weeks_analyzed ?? null,
      alert_level: wt?.alert_level ?? null,

      // ── Legacy metrics (preserved for backward compat) ─────────────────
      metrics: {
        "30d": {
          avg_success_rate: thisAvg30d,
          total_blocks_proposed: snaps30d.reduce((a, s) => a + s.blocksProposed, 0),
          total_blocks_missed: snaps30d.reduce((a, s) => a + s.blocksMissed, 0),
          epochs_observed: snaps30d.length,
        },
        all_time: {
          epochs_observed: snapshots.length,
          avg_success_rate: avg(snapshots.map((s) => s.successRate)),
        },
      },
    },
    { data_class: 1, source: "get_validator" }
  );
}
