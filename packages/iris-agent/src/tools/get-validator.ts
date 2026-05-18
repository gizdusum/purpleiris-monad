import { eq, desc } from "drizzle-orm";
import { getDb, validators, epochSnapshots, validatorMetadata } from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { GetValidatorInput, ToolResult } from "./types";

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
    })
    .from(validators)
    .leftJoin(validatorMetadata, eq(validators.id, validatorMetadata.pubkey))
    .where(addr ? eq(validators.id, addr) : eq(validators.slug, id))
    .limit(1);

  const row = rows[0] ?? null;

  if (!row) {
    return makeResult(
      { error: `Validator not found: ${id}` },
      { data_class: 1, source: "get_validator" }
    );
  }

  // Pull recent epoch snapshots for 7d and 30d metrics
  const snapshots = await db
    .select()
    .from(epochSnapshots)
    .where(eq(epochSnapshots.validatorId, row.id))
    .orderBy(desc(epochSnapshots.epoch))
    .limit(168);

  const now = Date.now();
  const ms7d = 7 * 24 * 60 * 60 * 1000;
  const ms30d = 30 * 24 * 60 * 60 * 1000;

  const snaps7d = snapshots.filter(
    (s) => now - s.snapshotAt.getTime() <= ms7d && !s.scheduledDowntime
  );
  const snaps30d = snapshots.filter(
    (s) => now - s.snapshotAt.getTime() <= ms30d && !s.scheduledDowntime
  );

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  return makeResult(
    {
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
      metrics: {
        "7d": {
          avg_success_rate: avg(snaps7d.map((s) => s.successRate)),
          total_blocks_proposed: snaps7d.reduce((a, s) => a + s.blocksProposed, 0),
          total_blocks_missed: snaps7d.reduce((a, s) => a + s.blocksMissed, 0),
          epochs_observed: snaps7d.length,
        },
        "30d": {
          avg_success_rate: avg(snaps30d.map((s) => s.successRate)),
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
