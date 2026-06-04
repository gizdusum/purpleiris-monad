// READ-ONLY public endpoint — no LLM/agent calls, no user data.
// Sources: validators table (DB) for counts, getWatchtowerOverview for epoch, getPublicClient.getBlockNumber()
// All from @purpleiris/monad-indexer; iris-agent is NOT touched.

import {
  getWatchtowerOverview,
  getPublicClient,
  getDb,
  validators,
} from "@purpleiris/monad-indexer";
import { sql, and } from "drizzle-orm";

// force-dynamic so Next.js doesn't replace our Cache-Control with max-age=0
export const dynamic = "force-dynamic";

export type StatusMetrics = {
  chainHead: number;
  validatorCount: number;
  activeValidators: number;
  epoch: number;
};

type CacheEntry = { data: StatusMetrics; fetchedAt: number };
const CACHE_MS = 30_000;
let cached: CacheEntry | null = null;

async function fetchMetrics(): Promise<StatusMetrics> {
  const db = getDb();

  const [blockResult, overviewResult, totalResult, activeResult] = await Promise.allSettled([
    getPublicClient().getBlockNumber(),
    getWatchtowerOverview(),
    db.select({ count: sql<number>`COUNT(*)` }).from(validators),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(validators)
      .where(and(sql`${validators.active} = true`, sql`${validators.jailed} = false`)),
  ]);

  const chainHead =
    blockResult.status === "fulfilled" ? Number(blockResult.value) : (cached?.data.chainHead ?? 0);

  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;

  const validatorCount =
    totalResult.status === "fulfilled"
      ? Number(totalResult.value[0]?.count ?? 0)
      : (cached?.data.validatorCount ?? 0);

  const activeValidators =
    activeResult.status === "fulfilled"
      ? Number(activeResult.value[0]?.count ?? 0)
      : (cached?.data.activeValidators ?? 0);

  const epoch = overview?.current_epoch ?? cached?.data.epoch ?? 0;

  return { chainHead, validatorCount, activeValidators, epoch };
}

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
    // Never 500 — return last good value or zeros
    const fallback: StatusMetrics = cached?.data ?? {
      chainHead: 0,
      validatorCount: 0,
      activeValidators: 0,
      epoch: 0,
    };
    return Response.json(fallback, {
      status: 200,
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
    });
  }
}
