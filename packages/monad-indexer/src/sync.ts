import { sql, notInArray, and, eq } from "drizzle-orm";
import { getDb } from "./db/client";
import { validators } from "./db/schema";
import { getLiveSnapshot, type LiveSnapshot } from "./live-snapshot";
import { getValidatorMeta } from "./validators";
import { toSlugFromValidator } from "./slug";

/**
 * Self-healing validator sync.
 *
 * Mirrors the first half of the long-running indexer worker (`worker.ts`): read
 * the validator set from the staking precompile and upsert it into `validators`.
 * It exists so the web deployment can refresh on-chain fields on its own schedule
 * when the worker is down, instead of serving a frozen table.
 *
 * It is safe to expose behind an unauthenticated endpoint because it is
 * idempotent, read-only towards the chain, and throttled by table freshness:
 * a run is skipped unless the table is older than `minIntervalMs`.
 */

export type IndexFreshness = {
  /** Most recent validators.updated_at, or null when the table is empty/unreachable. */
  indexedAt: string | null;
  ageSeconds: number | null;
  /** True when the data is older than `STALE_AFTER_MS` (or its age is unknown). */
  stale: boolean;
};

/** One and a half indexer cycles: the worker upserts every 5.5 hours. */
export const STALE_AFTER_MS = 8.25 * 60 * 60 * 1000;

const FRESHNESS_TTL_MS = 30_000;
let freshnessCache: { value: IndexFreshness; at: number } | null = null;

export function describeFreshness(
  indexedAt: Date | null,
  now: number = Date.now()
): IndexFreshness {
  if (!indexedAt || Number.isNaN(indexedAt.getTime())) {
    return { indexedAt: null, ageSeconds: null, stale: true };
  }
  const ageMs = Math.max(0, now - indexedAt.getTime());
  return {
    indexedAt: indexedAt.toISOString(),
    ageSeconds: Math.round(ageMs / 1000),
    stale: ageMs > STALE_AFTER_MS,
  };
}

/** Freshness of the indexed validator table. Cached for 30s. */
export async function getIndexFreshness(opts: { maxAgeMs?: number } = {}): Promise<IndexFreshness> {
  const maxAge = opts.maxAgeMs ?? FRESHNESS_TTL_MS;
  if (freshnessCache && Date.now() - freshnessCache.at < maxAge) return freshnessCache.value;

  const db = getDb();
  const rows = await db
    .select({ latest: sql<string | null>`MAX(${validators.updatedAt})` })
    .from(validators);
  const raw = rows[0]?.latest ?? null;
  // Column is `timestamp` without time zone, written in UTC by the worker.
  const parsed = raw
    ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw.replace(" ", "T")}Z`)
    : null;
  const value = describeFreshness(parsed);
  freshnessCache = { value, at: Date.now() };
  return value;
}

export function __resetFreshnessCache(): void {
  freshnessCache = null;
}

export type SyncResult =
  | { status: "skipped"; reason: "fresh"; freshness: IndexFreshness }
  | { status: "skipped"; reason: "incomplete_snapshot"; read: number; setSize: number }
  | {
      status: "synced";
      blockNumber: number;
      epoch: number;
      upserted: number;
      deactivated: number;
      syncedAt: string;
    };

export type SyncOptions = {
  /** Skip when the table was updated more recently than this. Default 20 min. */
  minIntervalMs?: number;
  /** Ignore the freshness throttle. */
  force?: boolean;
  snapshot?: LiveSnapshot;
};

let syncInflight: Promise<SyncResult> | null = null;

export async function syncValidatorsFromChain(opts: SyncOptions = {}): Promise<SyncResult> {
  if (syncInflight) return syncInflight;
  syncInflight = runSync(opts).finally(() => {
    syncInflight = null;
  });
  return syncInflight;
}

async function runSync(opts: SyncOptions): Promise<SyncResult> {
  const minIntervalMs = opts.minIntervalMs ?? 20 * 60_000;

  if (!opts.force) {
    const freshness = await getIndexFreshness({ maxAgeMs: 0 });
    if (freshness.ageSeconds !== null && freshness.ageSeconds * 1000 < minIntervalMs) {
      return { status: "skipped", reason: "fresh", freshness };
    }
  }

  const snapshot = opts.snapshot ?? (await getLiveSnapshot());

  // A partial read must never overwrite good rows or deactivate validators.
  if (!snapshot.complete || snapshot.validators.length === 0) {
    return {
      status: "skipped",
      reason: "incomplete_snapshot",
      read: snapshot.validators.length,
      setSize: snapshot.validatorSetSize,
    };
  }

  const meta = await getValidatorMeta();
  const metaByAddress = new Map(meta.map((m) => [m.address?.toLowerCase(), m] as const));

  const now = new Date();
  const rows = snapshot.validators.map((v) => {
    const m = metaByAddress.get(v.authAddress);
    const moniker = m?.name ?? `Validator ${v.validatorId}`;
    return {
      id: v.authAddress,
      secpPubkey: v.secpPubkey,
      moniker,
      website: m?.website ?? "",
      commissionBps: v.commissionBps,
      jailed: false,
      active: true, // present in the execution set
      stakedAmount: v.consensusStakeWei.toString(),
      region: m?.region ?? null,
      infraProvider: m?.infraProvider ?? null,
      slug: toSlugFromValidator(moniker, v.authAddress),
      unclaimedRewardsWei: v.unclaimedRewardsWei.toString(),
      updatedAt: now,
    };
  });

  const db = getDb();

  // Same conflict policy as worker.ts: never replace a real moniker/slug with the
  // "Validator N" placeholder, and keep existing registry enrichment when the
  // registry lookup comes back empty.
  await db
    .insert(validators)
    .values(rows)
    .onConflictDoUpdate({
      target: validators.id,
      set: {
        secpPubkey: sql`COALESCE(excluded.secp_pubkey, ${validators.secpPubkey})`,
        moniker: sql`CASE WHEN excluded.moniker ~ '^Validator [0-9]+$' THEN COALESCE(${validators.moniker}, excluded.moniker) ELSE excluded.moniker END`,
        website: sql`CASE WHEN excluded.website = '' THEN ${validators.website} ELSE excluded.website END`,
        commissionBps: sql`excluded.commission_bps`,
        jailed: sql`excluded.jailed`,
        active: sql`excluded.active`,
        stakedAmount: sql`excluded.staked_amount`,
        region: sql`COALESCE(excluded.region, ${validators.region})`,
        infraProvider: sql`COALESCE(excluded.infra_provider, ${validators.infraProvider})`,
        slug: sql`CASE WHEN excluded.moniker ~ '^Validator [0-9]+$' THEN COALESCE(${validators.slug}, excluded.slug) ELSE excluded.slug END`,
        unclaimedRewardsWei: sql`excluded.unclaimed_rewards_wei`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  // Validators that left the execution set are no longer active. Only done on a
  // complete snapshot (checked above), so an RPC hiccup cannot deactivate anyone.
  const currentIds = rows.map((r) => r.id);
  const deactivated = await db
    .update(validators)
    .set({ active: false })
    .where(and(eq(validators.active, true), notInArray(validators.id, currentIds)))
    .returning({ id: validators.id });

  freshnessCache = null;

  return {
    status: "synced",
    blockNumber: snapshot.blockNumber,
    epoch: snapshot.epoch,
    upserted: rows.length,
    deactivated: deactivated.length,
    syncedAt: now.toISOString(),
  };
}
