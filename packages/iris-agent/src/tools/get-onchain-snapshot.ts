import { inArray } from "drizzle-orm";
import {
  getDb,
  validators,
  getLiveSnapshot,
  summarizeSnapshot,
  weiToMon,
  STAKING_PRECOMPILE,
  monadMainnet,
  type LiveSnapshot,
} from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { GetOnchainSnapshotInput, ToolResult } from "./types";

const DEFAULT_TOP_N = 10;
const MAX_TOP_N = 50;

/** Best-effort moniker lookup. The chain has no names; these come from the indexed registry. */
async function lookupMonikers(addresses: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (addresses.length === 0) return out;
  try {
    const rows = await getDb()
      .select({ id: validators.id, moniker: validators.moniker })
      .from(validators)
      .where(inArray(validators.id, addresses));
    for (const r of rows) out.set(r.id, r.moniker);
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
    unclaimed_commission_mon: weiToMon(v.unclaimedRewardsWei),
  }));

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
    total_consensus_stake_mon: summary.totalConsensusStakeMon,
    total_stake_mon: summary.totalStakeMon,
    nakamoto_coefficient: {
      value: summary.nakamotoCoefficient,
      interpretation: `Minimum ${summary.nakamotoCoefficient} validators hold more than one third of consensus stake`,
      data_class: 2,
      formula: "nakamoto_coefficient v1.0 (see /methodology)",
    },
    top_validator_share_pct: summary.topValidatorSharePct,
    median_commission_bps: summary.medianCommissionBps,
    derived_data_class: 2,

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
    .map((v) => v.authAddress);
  const monikers = await lookupMonikers(ranked);

  return makeResult(buildSnapshotPayload(snapshot, monikers, topN), {
    data_class: 1,
    source: "get_onchain_snapshot",
  });
}
