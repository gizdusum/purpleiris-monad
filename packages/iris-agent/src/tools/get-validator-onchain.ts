import {
  readLiveValidator,
  getLiveSnapshot,
  weiToMon,
  describeValidatorFlags,
  STAKING_PRECOMPILE,
  monadMainnet,
  type LiveValidatorDetail,
  type LiveDelegatorPosition,
} from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { GetValidatorOnchainInput, ToolResult } from "./types";
import { lookupMonikers } from "./get-onchain-snapshot";
import { resolveValidatorByName } from "./lib/resolve-validator";

const SOURCE = "get_validator_onchain";
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const NUMERIC_ID_RE = /^\d{1,9}$/;

function position(p: LiveDelegatorPosition, currentEpoch: number) {
  const pending = [
    { amount_mon: weiToMon(p.deltaStakeWei), activates_at_epoch: p.deltaEpoch },
    { amount_mon: weiToMon(p.nextDeltaStakeWei), activates_at_epoch: p.nextDeltaEpoch },
  ].filter((x) => x.amount_mon > 0);
  return {
    address: p.address,
    has_position: p.stakeWei > 0n || p.unclaimedRewardsWei > 0n || pending.length > 0,
    active_stake_mon: weiToMon(p.stakeWei),
    claimable_rewards_mon: weiToMon(p.unclaimedRewardsWei),
    pending_stake: pending,
    current_epoch: currentEpoch,
  };
}

/** Pure mapping from a live read to the tool payload. Exported for tests. */
export function buildValidatorOnchainPayload(d: LiveValidatorDetail, moniker: string | null) {
  const methods = ["getEpoch()", "getValidator(uint64)", "getDelegator(uint64,address)"];
  const provenance = {
    as_of_block: d.blockNumber,
    epoch: d.epoch,
    in_epoch_delay_period: d.inEpochDelayPeriod,
    read_at: d.fetchedAt,
    chain_id: monadMainnet.id,
    staking_precompile: STAKING_PRECOMPILE,
    read_methods: d.exists ? methods : methods.slice(0, 2),
  };

  if (!d.exists) {
    return {
      ...provenance,
      validator_id: d.validatorId,
      not_found: true,
      error: `The staking precompile has no validator with id ${d.validatorId} at block ${d.blockNumber}.`,
    };
  }

  const commissionChangePending =
    d.commissionBps !== d.consensusCommissionBps ||
    d.consensusCommissionBps !== d.snapshotCommissionBps;

  return {
    ...provenance,

    // ── Class 1: read directly from the precompile at as_of_block ──
    validator: {
      validator_id: d.validatorId,
      auth_address: d.authAddress,
      moniker,
      moniker_data_class: 3,
      secp_pubkey: d.secpPubkey,
      flags: {
        raw: d.flags.raw,
        ok: d.flags.ok,
        stake_too_low: d.flags.stakeTooLow,
        withdrawn: d.flags.withdrawn,
        double_sign: d.flags.doubleSign,
        unknown_bits: d.flags.unknownBits,
        meaning: describeValidatorFlags(d.flags),
      },
      stake_mon: {
        execution: weiToMon(d.stakeWei),
        consensus: weiToMon(d.consensusStakeWei),
        snapshot: weiToMon(d.snapshotStakeWei),
      },
      commission_bps: {
        execution: d.commissionBps,
        consensus: d.consensusCommissionBps,
        snapshot: d.snapshotCommissionBps,
      },
      pool_unclaimed_rewards_mon: weiToMon(d.poolUnclaimedRewardsWei),
      views_note:
        "execution = latest state, including changes not active yet. consensus = used by consensus in the current epoch. snapshot = previous consensus view, used during the epoch delay period. pool_unclaimed_rewards_mon belongs to all delegators of this validator and is not the operator's commission.",
    },

    // The auth address's own delegator record: where commission is credited.
    operator: d.authDelegator
      ? {
          ...position(d.authDelegator, d.epoch),
          note: "claimable_rewards_mon is what the auth address can claim now: commission plus rewards on its own stake. The chain does not separate the two.",
        }
      : null,

    ...(d.delegator && d.delegator !== d.authDelegator
      ? { delegator: position(d.delegator, d.epoch) }
      : {}),

    // ── Class 2: derived from the Class 1 values above ──
    derived: {
      data_class: 2,
      pending_stake_change_mon: weiToMon(d.stakeWei) - weiToMon(d.consensusStakeWei),
      commission_change_pending: commissionChangePending,
      note: "pending_stake_change_mon = execution stake minus consensus stake: delegations and undelegations that are not active in consensus yet.",
    },

    moniker_note:
      "Monikers are not on-chain. They come from the community validator registry via the indexer and are Class 3 (self-reported).",
  };
}

type Resolved =
  | { kind: "id"; validatorId: number }
  | { kind: "miss"; data: Record<string, unknown> };

async function resolveId(raw: string): Promise<Resolved> {
  const id = raw.trim();
  if (NUMERIC_ID_RE.test(id)) return { kind: "id", validatorId: Number(id) };

  let address: string | null = ADDRESS_RE.test(id) ? id.toLowerCase() : null;

  if (!address) {
    const resolved = await resolveValidatorByName(id);
    if (resolved.kind === "candidates") {
      return { kind: "miss", data: { candidate_matches: resolved.candidates } };
    }
    if (resolved.kind === "not_found") {
      return { kind: "miss", data: { error: `Validator not found: ${id}`, not_found: true } };
    }
    address = resolved.id.toLowerCase();
  }

  // The chain has no address -> id getter, so map through the live validator set.
  const snapshot = await getLiveSnapshot();
  const hit = snapshot.validators.find((v) => v.authAddress === address);
  if (!hit) {
    return {
      kind: "miss",
      data: {
        error: `${address} is not an auth address in the execution validator set at block ${snapshot.blockNumber}.`,
        not_found: true,
        hint: "Pass the numeric validator id to read a validator that is outside the current set.",
      },
    };
  }
  return { kind: "id", validatorId: hit.validatorId };
}

export async function getValidatorOnchainTool(
  input: GetValidatorOnchainInput
): Promise<ToolResult> {
  const delegator = input.delegator_address?.trim();
  if (delegator && !ADDRESS_RE.test(delegator)) {
    return makeResult(
      { error: "delegator_address must be a 0x-prefixed 20-byte address.", invalid_input: true },
      { data_class: 1, source: SOURCE }
    );
  }

  const resolved = await resolveId(String(input.id ?? ""));
  if (resolved.kind === "miss") {
    return makeResult(resolved.data, { data_class: 1, source: SOURCE });
  }

  const detail = await readLiveValidator({
    validatorId: resolved.validatorId,
    ...(delegator ? { delegator } : {}),
  });

  const monikers = detail.exists
    ? await lookupMonikers([{ authAddress: detail.authAddress, secpPubkey: detail.secpPubkey }])
    : new Map<string, string>();

  return makeResult(
    buildValidatorOnchainPayload(detail, monikers.get(detail.authAddress) ?? null),
    { data_class: 1, source: SOURCE }
  );
}
