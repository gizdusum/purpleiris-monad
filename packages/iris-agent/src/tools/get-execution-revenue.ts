import { eq, sql } from "drizzle-orm";
import {
  getDb,
  validators,
  validatorMetadata,
  validatorExecutionRevenue,
} from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { GetExecutionRevenueInput, ToolResult } from "./types";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? (prev[j - 1] ?? 0)
          : 1 + Math.min(prev[j] ?? 0, curr[j - 1] ?? 0, prev[j - 1] ?? 0);
    }
    prev = curr;
  }
  return prev[n] ?? 0;
}

const WEI_PER_MON = 1_000_000_000_000_000_000n;

function weiToMon(wei: string): number {
  const w = BigInt(wei);
  const whole = w / WEI_PER_MON;
  const frac = Number(w - whole * WEI_PER_MON) / 1e18;
  return Number(whole) + frac;
}

async function resolveValidatorId(
  identifier: string
): Promise<{ validatorId: string; moniker: string } | null> {
  const db = getDb();
  const isAddr = identifier.toLowerCase().startsWith("0x");
  const idLower = identifier.toLowerCase();
  const joinCond = sql`${validators.secpPubkey} IS NOT NULL AND ${validators.secpPubkey} = ${validatorMetadata.pubkey}`;

  // Address lookup
  if (isAddr) {
    const rows = await db
      .select({ id: validators.id, moniker: validators.moniker })
      .from(validators)
      .where(eq(validators.id, idLower))
      .limit(1);
    const r = rows[0];
    return r ? { validatorId: r.id, moniker: r.moniker } : null;
  }

  // Exact slug/moniker match
  const exactRows = await db
    .select({
      id: validators.id,
      moniker: validators.moniker,
      metaMoniker: validatorMetadata.moniker,
    })
    .from(validators)
    .leftJoin(validatorMetadata, joinCond)
    .where(
      sql`LOWER(${validators.slug}) = ${idLower}
        OR LOWER(${validators.moniker}) = ${idLower}
        OR LOWER(${validatorMetadata.moniker}) = ${idLower}`
    )
    .limit(1);

  if (exactRows[0]) {
    const r = exactRows[0];
    return { validatorId: r.id, moniker: r.metaMoniker ?? r.moniker };
  }

  // Fuzzy fallback via Levenshtein
  const allRows = await db
    .select({
      id: validators.id,
      moniker: validators.moniker,
      slug: validators.slug,
      metaMoniker: validatorMetadata.moniker,
    })
    .from(validators)
    .leftJoin(validatorMetadata, joinCond)
    .where(eq(validators.active, true));

  const normInput = normalize(identifier);
  const candidates = allRows
    .map((v) => {
      const label = v.metaMoniker ?? v.moniker ?? v.slug ?? "";
      const normLabel = normalize(label);
      const normSlug = normalize(v.slug ?? "");
      const dist = Math.min(levenshtein(normInput, normLabel), levenshtein(normInput, normSlug));
      const isSubstring =
        normLabel.includes(normInput) ||
        normInput.includes(normLabel) ||
        normSlug.includes(normInput);
      return { id: v.id, moniker: label, dist, isSubstring };
    })
    .filter((c) => c.dist <= 3 || c.isSubstring)
    .sort((a, b) => a.dist - b.dist || a.moniker.localeCompare(b.moniker));

  const top = candidates[0];
  return top ? { validatorId: top.id, moniker: top.moniker } : null;
}

export async function getExecutionRevenueTool({
  validator_identifier,
}: GetExecutionRevenueInput): Promise<ToolResult> {
  const db = getDb();

  const resolved = await resolveValidatorId(validator_identifier);
  if (!resolved) {
    return makeResult(
      { error: `Validator not found: ${validator_identifier}`, not_found: true },
      { data_class: 1, source: "get_execution_revenue" }
    );
  }

  const { validatorId, moniker } = resolved;
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [[agg7d], [agg24h], frontierRows] = await Promise.all([
    db
      .select({
        total: sql<string>`COALESCE(SUM(fee_revenue_wei::numeric), 0)`,
        tx_count: sql<string>`COALESCE(SUM(tx_count), 0)`,
        day_count: sql<string>`COUNT(DISTINCT DATE_TRUNC('day', block_timestamp))`,
      })
      .from(validatorExecutionRevenue)
      .where(
        sql`${validatorExecutionRevenue.validatorId} = ${validatorId}
          AND ${validatorExecutionRevenue.blockTimestamp} >= ${sevenDaysAgo}`
      ),
    db
      .select({ total: sql<string>`COALESCE(SUM(fee_revenue_wei::numeric), 0)` })
      .from(validatorExecutionRevenue)
      .where(
        sql`${validatorExecutionRevenue.validatorId} = ${validatorId}
          AND ${validatorExecutionRevenue.blockTimestamp} >= ${oneDayAgo}`
      ),
    db
      .select({ maxTs: sql<string | null>`MAX(${validatorExecutionRevenue.blockTimestamp})::text` })
      .from(validatorExecutionRevenue)
      .where(sql`${validatorExecutionRevenue.validatorId} = ${validatorId}`),
  ]);

  const indexerMaxTs = frontierRows[0]?.maxTs ? new Date(frontierRows[0].maxTs) : null;
  const data24hComplete = indexerMaxTs !== null && indexerMaxTs >= oneDayAgo;

  const total7dMon = weiToMon(agg7d?.total ?? "0");
  const total24hMon = weiToMon(agg24h?.total ?? "0");
  const dayCount = Number(agg7d?.day_count ?? 0);
  const avgPerDayMon = dayCount > 0 ? total7dMon / dayCount : 0;

  if (total7dMon === 0) {
    return makeResult(
      {
        validator_id: validatorId,
        moniker,
        error: "No execution revenue data found for this validator in the last 7 days.",
        not_indexed: true,
      },
      { data_class: 1, source: "get_execution_revenue" }
    );
  }

  // Best and worst day
  const dailyRows = await db
    .select({
      day: sql<string>`DATE_TRUNC('day', block_timestamp)::text`,
      amount: sql<string>`SUM(fee_revenue_wei::numeric)`,
    })
    .from(validatorExecutionRevenue)
    .where(
      sql`${validatorExecutionRevenue.validatorId} = ${validatorId}
        AND ${validatorExecutionRevenue.blockTimestamp} >= ${sevenDaysAgo}`
    )
    .groupBy(sql`DATE_TRUNC('day', block_timestamp)`)
    .orderBy(sql`SUM(fee_revenue_wei::numeric) DESC`);

  const bestDay = dailyRows[0]
    ? { date: dailyRows[0].day.slice(0, 10), amount_mon: weiToMon(dailyRows[0].amount) }
    : null;
  const worstDay = dailyRows[dailyRows.length - 1]
    ? {
        date: dailyRows[dailyRows.length - 1]!.day.slice(0, 10),
        amount_mon: weiToMon(dailyRows[dailyRows.length - 1]!.amount),
      }
    : null;

  // Trend: last 3 days vs first 3 days
  const sorted = [...dailyRows].sort((a, b) => a.day.localeCompare(b.day));
  let trendPct = 0;
  let trendDirection: "up" | "down" | "flat" = "flat";
  if (sorted.length >= 6) {
    const firstThree = sorted.slice(0, 3).reduce((s, r) => s + weiToMon(r.amount), 0) / 3;
    const lastThree = sorted.slice(-3).reduce((s, r) => s + weiToMon(r.amount), 0) / 3;
    if (firstThree > 0) {
      trendPct = (lastThree / firstThree - 1) * 100;
      trendDirection = Math.abs(trendPct) < 5 ? "flat" : trendPct > 0 ? "up" : "down";
    }
  }

  // Network-wide stats
  const [networkAgg] = await db
    .select({
      total_validators: sql<string>`COUNT(DISTINCT validator_id)`,
    })
    .from(validatorExecutionRevenue)
    .where(sql`${validatorExecutionRevenue.blockTimestamp} >= ${sevenDaysAgo}`);

  const totalValidatorsWithData = Number(networkAgg?.total_validators ?? 0);

  // Network median per day
  const perValidatorRows = await db
    .select({
      validator_id: validatorExecutionRevenue.validatorId,
      total: sql<string>`SUM(fee_revenue_wei::numeric) / NULLIF(COUNT(DISTINCT DATE_TRUNC('day', block_timestamp)), 0)`,
    })
    .from(validatorExecutionRevenue)
    .where(sql`${validatorExecutionRevenue.blockTimestamp} >= ${sevenDaysAgo}`)
    .groupBy(validatorExecutionRevenue.validatorId)
    .orderBy(sql`SUM(fee_revenue_wei::numeric) DESC`);

  // Compute median
  const sorted_vals = perValidatorRows.map((r) => weiToMon(r.total ?? "0")).sort((a, b) => a - b);
  let networkMedianPerDayMon = 0;
  if (sorted_vals.length > 0) {
    const mid = Math.floor(sorted_vals.length / 2);
    networkMedianPerDayMon =
      sorted_vals.length % 2 !== 0
        ? (sorted_vals[mid] ?? 0)
        : ((sorted_vals[mid - 1] ?? 0) + (sorted_vals[mid] ?? 0)) / 2;
  }

  // Validator rank by 7d total
  const validatorRank = perValidatorRows.findIndex((r) => r.validator_id === validatorId) + 1;

  const pctVsMedian =
    networkMedianPerDayMon > 0 ? (avgPerDayMon / networkMedianPerDayMon - 1) * 100 : 0;

  const dataComplete = dayCount >= 7;

  return makeResult(
    {
      validator_id: validatorId,
      moniker,
      total_7d_mon: Math.round(total7dMon * 1e6) / 1e6,
      total_24h_mon: Math.round(total24hMon * 1e6) / 1e6,
      avg_per_day_mon: Math.round(avgPerDayMon * 1e6) / 1e6,
      best_day: bestDay,
      worst_day: worstDay,
      trend_pct: Math.round(trendPct * 10) / 10,
      trend_direction: trendDirection,
      network_median_per_day_mon: Math.round(networkMedianPerDayMon * 1e6) / 1e6,
      validator_rank: validatorRank || null,
      validator_total_validators: totalValidatorsWithData,
      total_validators_note:
        "Validators with execution-fee data in the last 7 days — distinct from active-validator count (network overview) and Watchtower-tracked count.",
      pct_vs_median: Math.round(pctVsMedian * 10) / 10,
      data_class: 1,
      data_complete: dataComplete,
      window_days: dayCount,
      indexer_max_ts: indexerMaxTs?.toISOString().slice(0, 10) ?? null,
      data_24h_complete: data24hComplete,
      twenty_four_h_note: !data24hComplete
        ? `24h window not yet indexed — indexer current as of ${indexerMaxTs?.toISOString().slice(0, 10) ?? "unknown"}. Use 7d figure.`
        : null,
    },
    { data_class: 1, source: "get_execution_revenue" }
  );
}
