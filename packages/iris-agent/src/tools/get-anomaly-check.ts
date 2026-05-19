import { eq, sql, desc, and } from "drizzle-orm";
import {
  getDb,
  validators,
  epochSnapshots,
  validatorMetadata,
  getWatchtowerOverview,
} from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { ToolResult } from "./types";

export type GetAnomalyCheckInput = { validator_id: string; window_hours?: number };

type AnomalyType =
  | "timeout_cluster"
  | "success_rate_drop"
  | "streak_break"
  | "vdp_status_change"
  | "assignment_drop"
  | "extended_offline";

type Severity = "low" | "medium" | "high";

type Anomaly = {
  type: AnomalyType;
  severity: Severity;
  detected_at: string;
  detail: string;
  window_data: Record<string, unknown>;
};

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export async function getAnomalyCheckTool({
  validator_id,
  window_hours = 24,
}: GetAnomalyCheckInput): Promise<ToolResult> {
  const db = getDb();
  const clampedHours = Math.min(Math.max(1, window_hours), 168);
  const isAddr = validator_id.toLowerCase().startsWith("0x");
  const idLower = validator_id.toLowerCase();

  const joinCond = sql`${validators.secpPubkey} IS NOT NULL AND ${validators.secpPubkey} = ${validatorMetadata.pubkey}`;

  const rows = await db
    .select({
      id: validators.id,
      moniker: validators.moniker,
      meta_moniker: validatorMetadata.moniker,
      slug: validators.slug,
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
      { data_class: 2, source: "get_anomaly_check" }
    );
  }

  const cutoff = new Date(Date.now() - clampedHours * 60 * 60 * 1000);

  const [snapsInWindow, recentSnaps, wtOverview] = await Promise.all([
    db
      .select()
      .from(epochSnapshots)
      .where(
        and(eq(epochSnapshots.validatorId, row.id), sql`${epochSnapshots.snapshotAt} > ${cutoff}`)
      )
      .orderBy(desc(epochSnapshots.epoch)),
    db
      .select()
      .from(epochSnapshots)
      .where(eq(epochSnapshots.validatorId, row.id))
      .orderBy(desc(epochSnapshots.epoch))
      .limit(10),
    getWatchtowerOverview().catch(() => null),
  ]);

  const wtEntry = row.secpPubkey
    ? (wtOverview?.validators.find((v) => v.node_id.slice(2).toLowerCase() === row.secpPubkey) ??
      null)
    : null;

  const anomalies: Anomaly[] = [];
  const now = new Date().toISOString();

  // 1. timeout_cluster: epochs with elevated missed blocks in window
  const highTimeoutEpochs = snapsInWindow.filter(
    (s) => s.blocksMissed >= 3 && !s.scheduledDowntime
  );
  if (highTimeoutEpochs.length > 0) {
    const totalTimeouts = highTimeoutEpochs.reduce((a, s) => a + s.blocksMissed, 0);
    const severity: Severity = totalTimeouts >= 11 ? "high" : totalTimeouts >= 6 ? "medium" : "low";
    anomalies.push({
      type: "timeout_cluster",
      severity,
      detected_at: now,
      detail: `${totalTimeouts} timeouts across ${highTimeoutEpochs.length} epoch${highTimeoutEpochs.length !== 1 ? "s" : ""} in the ${clampedHours}h window.`,
      window_data: { total_timeouts: totalTimeouts, affected_epochs: highTimeoutEpochs.length },
    });
  }

  // 2. success_rate_drop: current epoch vs prior 3-epoch rolling average
  const currentEpochRate = wtEntry ? wtEntry.current_epoch_success_rate / 100 : null;
  const prior3 = recentSnaps.filter((s) => !s.scheduledDowntime).slice(0, 3);
  const prior3Avg =
    prior3.length > 0 ? prior3.reduce((a, s) => a + s.successRate, 0) / prior3.length : null;

  if (currentEpochRate !== null && prior3Avg !== null) {
    const drop = prior3Avg - currentEpochRate;
    if (drop > 0.02) {
      const severity: Severity = drop > 0.07 ? "high" : drop > 0.04 ? "medium" : "low";
      const networkAvgRate =
        wtOverview && wtOverview.validators.length > 0
          ? wtOverview.validators.reduce((a, v) => a + v.current_epoch_success_rate / 100, 0) /
            wtOverview.validators.length
          : null;
      anomalies.push({
        type: "success_rate_drop",
        severity,
        detected_at: now,
        detail: `Success rate dropped from ${(prior3Avg * 100).toFixed(1)}% (3-epoch avg) to ${(currentEpochRate * 100).toFixed(1)}% in current epoch.${networkAvgRate !== null ? ` Network average: ${(networkAvgRate * 100).toFixed(1)}%.` : ""}`,
        window_data: {
          current_epoch_rate: currentEpochRate,
          prior_3epoch_avg: prior3Avg,
          drop_pp: Math.round(drop * 1000) / 10,
          network_avg: networkAvgRate,
        },
      });
    }
  }

  // 3. streak_break: consecutive_proposed is very low while recent epochs had strong activity
  if (wtEntry) {
    const consecutiveProposed = wtEntry.consecutive_proposed;
    const recentProposed = recentSnaps.slice(0, 5).reduce((a, s) => a + s.blocksProposed, 0);
    if (consecutiveProposed < 10 && recentProposed > 500) {
      const severity: Severity = recentProposed > 10000 ? "high" : "medium";
      anomalies.push({
        type: "streak_break",
        severity,
        detected_at: now,
        detail: `Consecutive blocks streak is very low (${consecutiveProposed}) despite strong recent output (~${recentProposed} blocks in last 5 epochs). Likely a recent miss.`,
        window_data: {
          consecutive_proposed: consecutiveProposed,
          recent_5epoch_proposed: recentProposed,
        },
      });
    }
  }

  // 4. vdp_status_change: any flagged VDP weeks (historical diff not available in v1.0)
  if (wtEntry && wtEntry.vdp_flagged_weeks > 0) {
    const vf = wtEntry.vdp_flagged_weeks;
    const severity: Severity = vf >= 3 ? "high" : "medium";
    anomalies.push({
      type: "vdp_status_change",
      severity,
      detected_at: now,
      detail: `${vf} flagged week${vf !== 1 ? "s" : ""} in VDP window. ${
        vf === 1
          ? "2 more triggers Foundation review."
          : vf === 2
            ? "1 more away from removal review."
            : "Currently in review territory."
      }`,
      window_data: {
        vdp_flagged_weeks: vf,
        vdp_weeks_analyzed: wtEntry.vdp_weeks_analyzed,
      },
    });
  }

  // 5. extended_offline: last_seen > 5 minutes
  if (wtEntry) {
    const lastSeenMs = Date.now() - new Date(wtEntry.last_seen).getTime();
    if (lastSeenMs > 5 * 60 * 1000) {
      const minutesAgo = Math.round(lastSeenMs / 60_000);
      const severity: Severity = minutesAgo >= 30 ? "high" : "medium";
      anomalies.push({
        type: "extended_offline",
        severity,
        detected_at: now,
        detail: `Last seen ${minutesAgo} minute${minutesAgo !== 1 ? "s" : ""} ago — ${minutesAgo >= 30 ? "well outside" : "past"} the normal heartbeat window.`,
        window_data: {
          last_seen: wtEntry.last_seen,
          minutes_ago: minutesAgo,
          is_down: wtEntry.is_down,
        },
      });
    }
  }

  anomalies.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const signal_count = anomalies.length;
  const highestSeverity = anomalies[0]?.severity ?? null;

  const summary =
    signal_count === 0
      ? `Quiet window. Nothing notable in the last ${clampedHours}h.`
      : signal_count === 1
        ? `1 signal — ${highestSeverity} severity. ${anomalies[0]?.detail ?? ""}`
        : `${signal_count} signals. Highest severity: ${highestSeverity}. See anomaly list for details.`;

  return makeResult(
    {
      fetched_at: new Date().toISOString(),
      validator_id: row.id,
      validator_moniker: row.meta_moniker ?? row.moniker,
      window_hours: clampedHours,
      signal_count,
      anomalies,
      summary,
      data_note: "Class 2 — derived from epoch snapshots and Watchtower live data.",
    },
    { data_class: 2, source: "get_anomaly_check" }
  );
}
