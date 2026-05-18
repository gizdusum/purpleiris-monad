import { eq, desc } from "drizzle-orm";
import { getDb, validators, epochSnapshots, validatorMetadata } from "@purpleiris/monad-indexer";
import { sql } from "drizzle-orm";
import { makeResult } from "./types";
import type { GetRecentAssignmentsInput, ToolResult } from "./types";

export async function getRecentAssignmentsTool({
  validator_id,
  limit = 20,
}: GetRecentAssignmentsInput): Promise<ToolResult> {
  const db = getDb();
  const clampedLimit = Math.min(Math.max(1, limit), 100);
  const addr = validator_id.toLowerCase().startsWith("0x") ? validator_id.toLowerCase() : null;

  // Resolve validator
  const rows = await db
    .select({
      id: validators.id,
      moniker: validators.moniker,
      meta_moniker: validatorMetadata.moniker,
      slug: validators.slug,
    })
    .from(validators)
    .leftJoin(
      validatorMetadata,
      sql`${validators.secpPubkey} IS NOT NULL AND ${validators.secpPubkey} = ${validatorMetadata.pubkey}`
    )
    .where(addr ? eq(validators.id, addr) : eq(validators.slug, validator_id))
    .limit(1);

  const row = rows[0] ?? null;
  if (!row) {
    return makeResult(
      { error: `Validator not found: ${validator_id}` },
      { data_class: 1, source: "get_recent_assignments" }
    );
  }

  const snaps = await db
    .select({
      epoch: epochSnapshots.epoch,
      snapshotAt: epochSnapshots.snapshotAt,
      blocksProposed: epochSnapshots.blocksProposed,
      blocksMissed: epochSnapshots.blocksMissed,
      successRate: epochSnapshots.successRate,
      scheduledDowntime: epochSnapshots.scheduledDowntime,
    })
    .from(epochSnapshots)
    .where(eq(epochSnapshots.validatorId, row.id))
    .orderBy(desc(epochSnapshots.epoch))
    .limit(clampedLimit);

  const assignments = snaps.map((s) => ({
    epoch: s.epoch,
    snapshot_at: s.snapshotAt.toISOString(),
    blocks_proposed: s.blocksProposed,
    blocks_missed: s.blocksMissed,
    success_rate: s.successRate,
    scheduled_downtime: s.scheduledDowntime,
  }));

  return makeResult(
    {
      validator_id: row.id,
      moniker: row.meta_moniker ?? row.moniker,
      slug: row.slug,
      data_granularity: "epoch",
      epoch_duration_note: "Each epoch is ~5.5 hours. This is epoch-level data, not per-round.",
      limit: clampedLimit,
      returned: assignments.length,
      assignments,
    },
    { data_class: 1, source: "get_recent_assignments" }
  );
}
