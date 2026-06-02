import type { WatchtowerValidator, WatchtowerOverview } from "@purpleiris/shared-types";

const BASE = "https://monad-watchtower.xyz";
const FRESH_MS = 30_000;
const STALE_MS = 300_000;
const MAX_STALE_ON_ERROR_MS = 900_000;

type CacheEntry = { data: WatchtowerOverview; fetchedAt: number };

let lastGood: CacheEntry | null = null;
let inflight: Promise<WatchtowerOverview> | null = null;

async function fetchFresh(): Promise<WatchtowerOverview> {
  const res = await fetch(`${BASE}/api/overview`, {
    signal: AbortSignal.timeout(8_000),
    headers: { "User-Agent": "PurpleIris/2.0" },
  });
  if (!res.ok) throw new Error(`Watchtower API ${res.status}`);
  return res.json() as Promise<WatchtowerOverview>;
}

function getOrCreateInflight(): Promise<WatchtowerOverview> {
  if (inflight) return inflight;
  inflight = fetchFresh().then(
    (data) => {
      lastGood = { data, fetchedAt: Date.now() };
      inflight = null;
      return data;
    },
    (err: unknown) => {
      inflight = null;
      const age = lastGood ? Date.now() - lastGood.fetchedAt : Infinity;
      if (lastGood && age < MAX_STALE_ON_ERROR_MS) return lastGood.data;
      throw err;
    }
  );
  return inflight;
}

export async function getWatchtowerOverview(): Promise<WatchtowerOverview> {
  try {
    const now = Date.now();
    const age = lastGood ? now - lastGood.fetchedAt : Infinity;

    // FRESH — return cached immediately, no network call
    if (lastGood && age < FRESH_MS) return lastGood.data;

    // STALE — return cached immediately, revalidate in background
    if (lastGood && age < STALE_MS) {
      const p = getOrCreateInflight();
      p.catch(() => {}); // suppress unhandled rejection (nobody awaits in this path)
      return lastGood.data;
    }

    // BLOCKING — no good cache or too stale: await fetch (inflight dedup)
    return getOrCreateInflight();
  } catch {
    // Cache logic error: fall back to plain fetch (cache never blocks callers)
    return fetchFresh();
  }
}

export type { WatchtowerValidator, WatchtowerOverview };
