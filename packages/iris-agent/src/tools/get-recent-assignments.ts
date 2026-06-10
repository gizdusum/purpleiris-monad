import { eq, desc, sql } from "drizzle-orm";
import { getDb, validators, epochSnapshots, validatorMetadata } from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { GetRecentAssignmentsInput, ToolResult } from "./types";
import { resolveValidatorByName } from "./lib/resolve-validator";

export async function getRecentAssignmentsTool({
  validator_id,
  limit = 20,
}: GetRecentAssignmentsInput): Promise<ToolResult> {
  const db = getDb();
  const clampedLimit = Math.min(Math.max(1, limit), 100);
  const isAddr = validator_id.toLowerCase().startsWith("0x");
  const addr = isAddr ? validator_id.toLowerCase() : null;

  const joinCond = sql`${validators.secpPubkey} IS NOT NULL AND ${validators.secpPubkey} = ${validatorMetadata.pubkey}`;

  // Resolve validator — same logic as get_validator (exact → case-insensitive → fuzzy)
  let resolvedId: string;
  let resolvedMoniker: string;
  let resolvedSlug: string;
  let resolutionNote: string | null = null;

  if (addr) {
    const rows = await db
      .select({
        id: validators.id,
        moniker: validators.moniker,
        meta_moniker: validatorMetadata.moniker,
        slug: validators.slug,
      })
      .from(validators)
      .leftJoin(validatorMetadata, joinCond)
      .where(eq(validators.id, addr))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return makeResult(
        { error: `Validator not found: ${validator_id}`, not_found: true },
        { data_class: 1, source: "get_recent_assignments" }
      );
    }
    resolvedId = row.id;
    resolvedMoniker = row.meta_moniker ?? row.moniker ?? "";
    resolvedSlug = row.slug ?? "";
  } else {
    const resolved = await resolveValidatorByName(validator_id);
    if (resolved.kind === "not_found") {
      return makeResult(
        { error: `Validator not found: ${validator_id}`, not_found: true },
        { data_class: 1, source: "get_recent_assignments" }
      );
    }
    if (resolved.kind === "candidates") {
      return makeResult(
        { candidate_matches: resolved.candidates, resolution_note: null },
        { data_class: 1, source: "get_recent_assignments" }
      );
    }
    resolvedId = resolved.id;
    resolvedMoniker = resolved.moniker;
    resolvedSlug = resolved.slug;
    resolutionNote = resolved.resolutionNote;
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
    .where(eq(epochSnapshots.validatorId, resolvedId))
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
      validator_id: resolvedId,
      moniker: resolvedMoniker,
      slug: resolvedSlug,
      resolution_note: resolutionNote,
      data_granularity: "epoch",
      epoch_duration_note: "Each epoch is ~5.5 hours. This is epoch-level data, not per-round.",
      blocks_count_note:
        "Per-epoch block counts reflect indexer tick timing within each epoch, not epoch-final totals — do not read count changes across epochs as a performance or stake trend. Real signal is blocks_missed and success_rate only.",
      limit: clampedLimit,
      returned: assignments.length,
      assignments,
    },
    { data_class: 1, source: "get_recent_assignments" }
  );
}
