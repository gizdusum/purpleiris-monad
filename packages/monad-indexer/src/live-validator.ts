import { getPublicClient } from "./client";
import { STAKING_PRECOMPILE } from "./config";
import { STAKING_ABI } from "./staking-abi";
import { commissionToBps, type SnapshotReader } from "./live-snapshot";
import { decodeValidatorFlags, type DecodedValidatorFlags } from "./validator-flags";

/**
 * Live read of ONE validator from the Monad staking precompile, optionally with
 * one delegator's position in it.
 *
 * `getEpoch()`, `getValidator(id)` and each `getDelegator(id, address)` call are
 * pinned to the same block, so the result is one consistent view that anyone
 * can reproduce by replaying the calls at `blockNumber`. Class 1 (on-chain).
 *
 * The validator record has three views of stake and commission:
 *   execution  latest state, including changes that are not active yet
 *   consensus  what consensus uses for the current epoch
 *   snapshot   the previous consensus view, used during the epoch delay period
 */

export type LiveDelegatorPosition = {
  /** Delegator address, lowercased. */
  address: string;
  /** Active stake with this validator, in wei. */
  stakeWei: bigint;
  /** Rewards claimable now, in wei. The precompile settles them before answering. */
  unclaimedRewardsWei: bigint;
  /** Stake that becomes active at `deltaEpoch`, in wei. */
  deltaStakeWei: bigint;
  deltaEpoch: number;
  /** Stake that becomes active at `nextDeltaEpoch`, in wei. */
  nextDeltaStakeWei: bigint;
  nextDeltaEpoch: number;
};

export type LiveValidatorDetail = {
  blockNumber: number;
  epoch: number;
  inEpochDelayPeriod: boolean;
  /** ISO-8601 wall-clock time at which the read finished. */
  fetchedAt: string;
  validatorId: number;
  /** False when the precompile has no validator under this id. */
  exists: boolean;
  /** Auth address, lowercased. */
  authAddress: string;
  flags: DecodedValidatorFlags;
  stakeWei: bigint;
  consensusStakeWei: bigint;
  snapshotStakeWei: bigint;
  commissionBps: number;
  consensusCommissionBps: number;
  snapshotCommissionBps: number;
  /** Unclaimed rewards held in the validator's pool for all of its delegators. */
  poolUnclaimedRewardsWei: bigint;
  /** Compressed secp256k1 pubkey, hex without 0x, or null if absent. */
  secpPubkey: string | null;
  /**
   * The auth address's own delegator record. Commission is credited here, so
   * its unclaimed rewards are what the operator can claim: commission plus
   * rewards on the auth address's own stake. The chain does not separate them.
   */
  authDelegator: LiveDelegatorPosition | null;
  /** Position of the delegator the caller asked about, if any. */
  delegator: LiveDelegatorPosition | null;
};

type ValidatorTuple = readonly [
  `0x${string}`,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  `0x${string}`,
  `0x${string}`,
];

type DelegatorTuple = readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type ReadLiveValidatorOptions = {
  validatorId: number;
  /** Optional delegator address (0x + 40 hex) whose position should be read. */
  delegator?: string;
  reader?: SnapshotReader;
};

function toPosition(address: string, t: DelegatorTuple): LiveDelegatorPosition {
  return {
    address: address.toLowerCase(),
    stakeWei: t[0],
    unclaimedRewardsWei: t[2],
    deltaStakeWei: t[3],
    nextDeltaStakeWei: t[4],
    deltaEpoch: Number(t[5]),
    nextDeltaEpoch: Number(t[6]),
  };
}

export async function readLiveValidator(
  opts: ReadLiveValidatorOptions
): Promise<LiveValidatorDetail> {
  const reader = opts.reader ?? (getPublicClient() as unknown as SnapshotReader);
  const id = BigInt(opts.validatorId);

  const blockNumber = await reader.getBlockNumber();
  const base = { address: STAKING_PRECOMPILE, abi: STAKING_ABI, blockNumber } as const;

  const [epochResult, tuple] = (await Promise.all([
    reader.readContract({ ...base, functionName: "getEpoch" }),
    reader.readContract({ ...base, functionName: "getValidator", args: [id] }),
  ])) as [readonly [bigint, boolean], ValidatorTuple];

  const authAddress = tuple[0].toLowerCase();
  const exists = authAddress !== ZERO_ADDRESS;
  const secp = tuple[10];

  const readDelegator = async (address: string): Promise<LiveDelegatorPosition> =>
    toPosition(
      address,
      (await reader.readContract({
        ...base,
        functionName: "getDelegator",
        args: [id, address as `0x${string}`],
      })) as DelegatorTuple
    );

  const wanted = opts.delegator?.toLowerCase();
  const [authDelegator, delegator] = exists
    ? await Promise.all([
        readDelegator(authAddress),
        wanted && wanted !== authAddress ? readDelegator(wanted) : Promise.resolve(null),
      ])
    : [null, null];

  return {
    blockNumber: Number(blockNumber),
    epoch: Number(epochResult[0]),
    inEpochDelayPeriod: epochResult[1],
    fetchedAt: new Date().toISOString(),
    validatorId: opts.validatorId,
    exists,
    authAddress,
    flags: decodeValidatorFlags(tuple[1]),
    stakeWei: tuple[2],
    commissionBps: commissionToBps(tuple[4]),
    poolUnclaimedRewardsWei: tuple[5],
    consensusStakeWei: tuple[6],
    consensusCommissionBps: commissionToBps(tuple[7]),
    snapshotStakeWei: tuple[8],
    snapshotCommissionBps: commissionToBps(tuple[9]),
    secpPubkey: typeof secp === "string" && secp.length > 2 ? secp.slice(2).toLowerCase() : null,
    authDelegator,
    // Asking about the auth address itself returns the same record.
    delegator: wanted && wanted === authAddress ? authDelegator : delegator,
  };
}
