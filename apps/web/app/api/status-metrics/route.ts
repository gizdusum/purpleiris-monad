// READ-ONLY public endpoint — no LLM/agent calls, no user data.
//
// Every field is measured at request time (30s cache). Nothing is simulated:
//   chainHead, epoch      staking precompile + eth_blockNumber, via RPC (with public fallback)
//   validator counts      indexer's `validators` table
//   index                 age of that table (MAX(updated_at))
//   sources               whether each upstream answered this request

import {
  getChainState,
  getWatchtowerOverview,
  getIndexFreshness,
  getDb,
  validators,
  epochSnapshots,
  describeFreshness,
  type IndexFreshness,
} from "@purpleiris/monad-indexer";
import { sql, and } from "drizzle-orm";

// force-dynamic so Next.js doesn't replace our Cache-Control with max-age=0
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export type SourceState = "ok" | "down";

export type StatusMetrics = {
  /** Latest Monad mainnet block seen. 0 when the RPC could not be reached. */
  chainHead: number;
  /** Staking epoch from getEpoch() on the precompile. 0 when unavailable. */
  epoch: number;
  /** Where `epoch` came from. */
  epochSource: "staking-precompile" | "watchtower" | null;
  inEpochDelayPeriod: boolean | null;
  validatorCount: number;
  activeValidators: number;
  index: IndexFreshness;
  /**
   * Age of the newest per-epoch block-production snapshot. The indexer worker
   * writes these from the Watchtower feed, so this stays fresh even when this
   * deployment cannot reach the feed directly.
   */
  performance: IndexFreshness;
  sources: {
    rpc: SourceState;
    database: SourceState;
    /** "ok" when the feed answered this request, or its indexed data is fresh. */
    watchtower: SourceState;
  };
  /** ISO-8601 time this measurement was taken. */
  checkedAt: string;
};

type CacheEntry = { data: StatusMetrics; fetchedAt: number };
const CACHE_MS = 30_000;
let cached: CacheEntry | null = null;

const UNKNOWN_INDEX: IndexFreshness = { indexedAt: null, ageSeconds: null, stale: true };

async function fetchMetrics(): Promise<StatusMetrics> {
  const db = getDb();

  const [chainResult, overviewResult, totalResult, activeResult, indexResult, perfResult] =
    await Promise.allSettled([
      getChainState(),
      getWatchtowerOverview(),
      db.select({ count: sql<number>`COUNT(*)` }).from(validators),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(validators)
        .where(and(sql`${validators.active} = true`, sql`${validators.jailed} = false`)),
      getIndexFreshness(),
      db
        .select({ latest: sql<string | null>`MAX(${epochSnapshots.snapshotAt})` })
        .from(epochSnapshots),
    ]);

  const chain = chainResult.status === "fulfilled" ? chainResult.value : null;
  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;
  const dbOk = totalResult.status === "fulfilled" && activeResult.status === "fulfilled";

  const epoch = chain?.epoch ?? overview?.current_epoch ?? 0;

  const perfRaw = perfResult.status === "fulfilled" ? (perfResult.value[0]?.latest ?? null) : null;
  const performance = describeFreshness(
    perfRaw
      ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(perfRaw) ? perfRaw : `${perfRaw.replace(" ", "T")}Z`)
      : null
  );

  return {
    chainHead: chain?.blockNumber ?? 0,
    epoch,
    epochSource: chain ? "staking-precompile" : overview ? "watchtower" : null,
    inEpochDelayPeriod: chain?.inEpochDelayPeriod ?? null,
    validatorCount:
      totalResult.status === "fulfilled" ? Number(totalResult.value[0]?.count ?? 0) : 0,
    activeValidators:
      activeResult.status === "fulfilled" ? Number(activeResult.value[0]?.count ?? 0) : 0,
    index: indexResult.status === "fulfilled" ? indexResult.value : UNKNOWN_INDEX,
    performance,
    sources: {
      rpc: chain ? "ok" : "down",
      database: dbOk ? "ok" : "down",
      watchtower: overview || !performance.stale ? "ok" : "down",
    },
    checkedAt: new Date().toISOString(),
  };
}

const DOWN: StatusMetrics = {
  chainHead: 0,
  epoch: 0,
  epochSource: null,
  inEpochDelayPeriod: null,
  validatorCount: 0,
  activeValidators: 0,
  index: UNKNOWN_INDEX,
  performance: UNKNOWN_INDEX,
  sources: { rpc: "down", database: "down", watchtower: "down" },
  checkedAt: new Date(0).toISOString(),
};

export async function GET() {
  try {
    const now = Date.now();
    if (cached && now - cached.fetchedAt < CACHE_MS) {
      return Response.json(cached.data, {
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
      });
    }

    const data = await fetchMetrics();
    cached = { data, fetchedAt: now };

    return Response.json(data, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch {
    // Never 500. Report every source as down rather than replaying old numbers
    // as if they were current.
    return Response.json(
      { ...DOWN, checkedAt: new Date().toISOString() },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
      }
    );
  }
}
