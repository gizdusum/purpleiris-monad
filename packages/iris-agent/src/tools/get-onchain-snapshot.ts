import { inArray } from "drizzle-orm";
import {
  getDb,
  validators,
  validatorMetadata,
  getLiveSnapshot,
  summarizeSnapshot,
  weiToMon,
  decodeValidatorFlags,
  STAKING_PRECOMPILE,
  monadMainnet,
  type LiveSnapshot,
} from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { GetOnchainSnapshotInput, ToolResult } from "./types";

const DEFAULT_TOP_N = 10;
const MAX_TOP_N = 50;

const PLACEHOLDER_MONIKER = /^Validator \d+$/;

/**
 * Best-effort moniker lookup. The chain has no names: they come from the
 * community registry, which the indexer stores keyed by secp256k1 pubkey
 * (`validator_metadata`). The `validators` table is the fallback, ignoring its
 * "Validator N" placeholders.
 */
export async function lookupMonikers(
  targets: Array<{ authAddress: string; secpPubkey: string | null }>
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (targets.length === 0) return out;
  try {
    const db = getDb();
    const pubkeys = targets.map((t) => t.secpPubkey).filter((k): k is string => !!k);
    const [metaRows, validatorRows] = await Promise.all([
      pubkeys.length
        ? db
            .select({ pubkey: validatorMetadata.pubkey, moniker: validatorMetadata.moniker })
            .from(validatorMetadata)
            .where(inArray(validatorMetadata.pubkey, pubkeys))
        : Promise.resolve([]),
      db
        .select({ id: validators.id, moniker: validators.moniker })
        .from(validators)
        .where(
          inArray(
            validators.id,
            targets.map((t) => t.authAddress)
          )
        ),
    ]);

    const byPubkey = new Map(metaRows.map((r) => [r.pubkey.toLowerCase(), r.moniker]));
    const byAddress = new Map(validatorRows.map((r) => [r.id, r.moniker]));

    for (const t of targets) {
      const fromRegistry = t.secpPubkey ? byPubkey.get(t.secpPubkey) : null;
      const fromIndex = byAddress.get(t.authAddress);
      const name =
        fromRegistry?.trim() ||
        (fromIndex && !PLACEHOLDER_MONIKER.test(fromIndex) ? fromIndex : null);
      if (name) out.set(t.authAddress, name);
    }
  } catch {
    // Names are optional enrichment; the on-chain numbers stand on their own.
  }
  return out;
}

export function buildSnapshotPayload(
  snapshot: LiveSnapshot,
  monikers: Map<string, string>,
  topN: number
) {
  const summary = summarizeSnapshot(snapshot);
  const totalConsensusWei = snapshot.validators.reduce((a, v) => a + v.consensusStakeWei, 0n);

  const ranked = [...snapshot.validators].sort((a, b) =>
    a.consensusStakeWei > b.consensusStakeWei
      ? -1
      : a.consensusStakeWei < b.consensusStakeWei
        ? 1
        : 0
  );

  const top = ranked.slice(0, topN).map((v, i) => ({
    rank: i + 1,
    validator_id: v.validatorId,
    auth_address: v.authAddress,
    moniker: monikers.get(v.authAddress) ?? null,
    moniker_data_class: 3,
    commission_bps: v.commissionBps,
    commission_pct: v.commissionBps / 100,
    consensus_stake_mon: weiToMon(v.consensusStakeWei),
    stake_share_pct:
      totalConsensusWei === 0n
        ? 0
        : Number((v.consensusStakeWei * 1_000_000n) / totalConsensusWei) / 10_000,
    // Rewards held in the validator's pool for all of its delegators. Not commission.
    pool_unclaimed_rewards_mon: weiToMon(v.unclaimedRewardsWei),
    flags_ok: v.flags === 0n,
  }));

  const flagCounts = { ok: 0, stake_too_low: 0, withdrawn: 0, double_sign: 0 };
  for (const v of snapshot.validators) {
    const f = decodeValidatorFlags(v.flags);
    if (f.ok) flagCounts.ok++;
    if (f.stakeTooLow) flagCounts.stake_too_low++;
    if (f.withdrawn) flagCounts.withdrawn++;
    if (f.doubleSign) flagCounts.double_sign++;
  }

  return {
    // ── Provenance: everything below is reproducible from these four fields ──
    as_of_block: snapshot.blockNumber,
    epoch: snapshot.epoch,
    in_epoch_delay_period: snapshot.inEpochDelayPeriod,
    read_at: snapshot.fetchedAt,
    chain_id: monadMainnet.id,
    staking_precompile: STAKING_PRECOMPILE,
    read_methods: ["getEpoch()", "getExecutionValidatorSet(uint32)", "getValidator(uint64)"],

    // ── Class 1 — read directly from the precompile at as_of_block ──
    validator_set_size: summary.validatorSetSize,
    validators_read: summary.validatorsRead,
    complete: snapshot.complete,
    ...(snapshot.complete
      ? {}
      : {
          incomplete_note: `${snapshot.failedIds.length} of ${summary.validatorSetSize} validator reads failed; totals below cover only the validators that were read and understate the network.`,
        }),

    // ── Class 2 — derived from the Class 1 values above ──
    totals: {
      data_class: 2,
      note: "Sums and shares computed from the per-validator values read at as_of_block. Cite as Class 2, derived.",
      total_consensus_stake_mon: summary.totalConsensusStakeMon,
      total_stake_mon: summary.totalStakeMon,
      top_validator_share_pct: summary.topValidatorSharePct,
      median_commission_bps: summary.medianCommissionBps,
    },
    nakamoto_coefficient: {
      value: summary.nakamotoCoefficient,
      interpretation: `Minimum ${summary.nakamotoCoefficient} validators hold more than one third of consensus stake`,
      data_class: 2,
      formula: "nakamoto_coefficient v1.0 (see /methodology)",
    },

    validator_flags: {
      data_class: 2,
      note: "Counts of the on-chain flags field across the validators read. Any flag other than ok means the validator is not a candidate for the next consensus set.",
      ...flagCounts,
    },

    top_validators: top,
    moniker_note:
      "Monikers are not on-chain. They come from the community validator registry via the indexer and are Class 3 (self-reported).",
  };
}

export async function getOnchainSnapshotTool(
  input: GetOnchainSnapshotInput = {}
): Promise<ToolResult> {
  const requested = Number.isFinite(input.top_n)
    ? Math.floor(input.top_n as number)
    : DEFAULT_TOP_N;
  const topN = Math.min(MAX_TOP_N, Math.max(0, requested));

  const snapshot = await getLiveSnapshot();

  const ranked = [...snapshot.validators]
    .sort((a, b) =>
      a.consensusStakeWei > b.consensusStakeWei
        ? -1
        : a.consensusStakeWei < b.consensusStakeWei
          ? 1
          : 0
    )
    .slice(0, topN)
    .map((v) => ({ authAddress: v.authAddress, secpPubkey: v.secpPubkey }));
  const monikers = await lookupMonikers(ranked);

  return makeResult(buildSnapshotPayload(snapshot, monikers, topN), {
    data_class: 1,
    source: "get_onchain_snapshot",
  });
}
