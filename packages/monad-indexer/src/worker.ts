import "dotenv/config";
import { getDb } from "./db/client";
import { validators, epochSnapshots } from "./db/schema";
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

  // ── Epoch snapshots ────────────────────────────────────────────────────────
  // Guard: only run when Watchtower fetch succeeded. Failure here MUST NOT
  // crash or affect the validators upsert above.
  if (watchtower.status === "fulfilled") {
    try {
      const wto = watchtower.value;
      const epoch = wto.current_epoch;
      const snapshotAt = new Date(wto.current_epoch_started_at);

      // secp_pubkey (no 0x, lowercase) → { id, stakedAmount }
      // Rows already in scope from this tick — no extra DB or RPC call.
      const secpMap = new Map<string, { id: string; stakedAmount: string }>();
      for (const r of rows) {
        if (r.secpPubkey)
          secpMap.set(r.secpPubkey.toLowerCase(), { id: r.id, stakedAmount: r.stakedAmount });
      }

      const snapRows: {
        id: string;
        validatorId: string;
        epoch: number;
        blocksProposed: number;
        blocksMissed: number;
        successRate: number;
        votingPower: bigint;
        delegatorCount: number;
        scheduledDowntime: boolean;
        snapshotAt: Date;
      }[] = [];
      let skipped = 0;

      for (const v of wto.validators) {
        const key = v.node_id.slice(2).toLowerCase(); // strip 0x prefix
        const match = secpMap.get(key);
        if (!match) {
          skipped++;
          continue;
        }
        snapRows.push({
          id: `${match.id}:${epoch}`,
          validatorId: match.id,
          epoch,
          blocksProposed: v.current_epoch_finalized,
          blocksMissed: v.current_epoch_skipped,
          successRate: Math.min(1, Math.max(0, v.current_epoch_success_rate / 100)),
          votingPower: 0n, // stakedAmount in wei exceeds pg bigint max; column unused by tools
          delegatorCount: 0,
          scheduledDowntime: false,
          snapshotAt,
        });
      }

      const BATCH_SIZE = 500;
      for (let i = 0; i < snapRows.length; i += BATCH_SIZE) {
        await db
          .insert(epochSnapshots)
          .values(snapRows.slice(i, i + BATCH_SIZE))
          .onConflictDoUpdate({
            target: epochSnapshots.id,
            set: {
              blocksProposed: sql`excluded.blocks_proposed`,
              blocksMissed: sql`excluded.blocks_missed`,
              successRate: sql`excluded.success_rate`,
              votingPower: sql`excluded.voting_power`,
              snapshotAt: sql`excluded.snapshot_at`,
            },
          });
      }

      console.log(
        `[epoch-snapshots] wrote ${snapRows.length} rows for epoch ${epoch} (${skipped} skipped — no secp_pubkey)`
      );
    } catch (err) {
      console.error("[epoch-snapshots] write failed (validators upsert unaffected):", err);
    }
  }
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
