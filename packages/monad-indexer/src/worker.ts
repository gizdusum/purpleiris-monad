import "dotenv/config";
import { getDb } from "./db/client";
import { validators } from "./db/schema";
import { getValidatorsFromChain, getValidatorMeta } from "./validators";
import { getWatchtowerOverview } from "./watchtower";
import { toSlugFromValidator } from "./slug";
import { EPOCH_DURATION_MS } from "./config";
import { sql } from "drizzle-orm";

async function indexOnce() {
  const db = getDb();
  const [chainValidators, meta, watchtower] = await Promise.allSettled([
    getValidatorsFromChain(),
    getValidatorMeta(),
    getWatchtowerOverview(),
  ]);

  if (chainValidators.status === "rejected") {
    console.error("[indexer] chain read failed:", chainValidators.reason);
    return;
  }

  const metaList = meta.status === "fulfilled" ? meta.value : [];
  const wtMap = new Map(
    watchtower.status === "fulfilled"
      ? watchtower.value.validators.map((v) => [v.name.toLowerCase(), v])
      : []
  );

  const now = new Date();
  const rows = chainValidators.value.map((v) => {
    const m = metaList.find((m) => m.address?.toLowerCase() === v.address.toLowerCase());
    const wt = wtMap.get(v.moniker.toLowerCase());
    return {
      id: v.address.toLowerCase(),
      secpPubkey: v.secpPubkey ?? null,
      moniker: v.moniker,
      website: v.website,
      commissionBps: v.commissionBps,
      jailed: v.jailed,
      active: v.active,
      stakedAmount: v.stakedAmount.toString(),
      region: m?.region ?? null,
      infraProvider: m?.infraProvider ?? null,
      flag: wt ? null : null, // enriched separately via geo Phase 9
      country: null,
      slug: toSlugFromValidator(v.moniker, v.address),
      unclaimedRewardsWei: v.unclaimedRewards !== undefined ? v.unclaimedRewards.toString() : null,
      updatedAt: now,
    };
  });

  // Upsert all validators
  await db
    .insert(validators)
    .values(rows)
    .onConflictDoUpdate({
      target: validators.id,
      set: {
        secpPubkey: sql`COALESCE(excluded.secp_pubkey, ${validators.secpPubkey})`,
        moniker: sql`CASE WHEN excluded.moniker ~ '^Validator [0-9]+$' THEN COALESCE(${validators.moniker}, excluded.moniker) ELSE excluded.moniker END`,
        website: sql`excluded.website`,
        commissionBps: sql`excluded.commission_bps`,
        jailed: sql`excluded.jailed`,
        active: sql`excluded.active`,
        stakedAmount: sql`excluded.staked_amount`,
        region: sql`excluded.region`,
        infraProvider: sql`excluded.infra_provider`,
        slug: sql`CASE WHEN excluded.moniker ~ '^Validator [0-9]+$' THEN COALESCE(${validators.slug}, excluded.slug) ELSE excluded.slug END`,
        unclaimedRewardsWei: sql`excluded.unclaimed_rewards_wei`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  console.log(`[indexer] upserted ${rows.length} validators at ${now.toISOString()}`);
}

async function run() {
  console.log("[indexer] starting — interval:", EPOCH_DURATION_MS / 1000 / 60, "min");
  await indexOnce();
  setInterval(
    () => indexOnce().catch((e) => console.error("[indexer] tick error:", e)),
    EPOCH_DURATION_MS
  );
}

run().catch((e) => {
  console.error("[indexer] fatal:", e);
  process.exit(1);
});
