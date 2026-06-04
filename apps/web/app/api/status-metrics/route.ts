// READ-ONLY public endpoint — no LLM/agent calls, no user data.
// Sources: getWatchtowerOverview (packages/monad-indexer) + getPublicClient.getBlockNumber()
// Both imported directly from @purpleiris/monad-indexer; iris-agent is NOT touched.

import { getWatchtowerOverview, getPublicClient } from "@purpleiris/monad-indexer";

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
  const [overviewResult, blockResult] = await Promise.allSettled([
    getWatchtowerOverview(),
    getPublicClient().getBlockNumber(),
  ]);

  const chainHead =
    blockResult.status === "fulfilled" ? Number(blockResult.value) : (cached?.data.chainHead ?? 0);
  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : null;

  return {
    chainHead,
    validatorCount: overview?.validator_count ?? cached?.data.validatorCount ?? 0,
    activeValidators:
      overview?.global_stats.active_validators ?? cached?.data.activeValidators ?? 0,
    epoch: overview?.current_epoch ?? cached?.data.epoch ?? 0,
  };
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
