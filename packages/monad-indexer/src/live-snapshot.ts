import { getPublicClient } from "./client";
import { STAKING_PRECOMPILE } from "./config";
import { STAKING_ABI } from "./staking-abi";

/**
 * Live validator-set snapshot, read straight from the Monad staking precompile.
 *
 * No database, no third-party API: `getExecutionValidatorSet` (paginated) for the
 * validator ids, then `getValidator(id)` for each one. Every read is pinned to the
 * same block number, so the snapshot is a consistent view that anyone can
 * reproduce by replaying the same calls at `blockNumber`.
 *
 * Data class: 1 (on-chain, deterministic). Totals and the Nakamoto coefficient
 * computed from it are Class 2 (derived).
 */

export type LiveValidator = {
  validatorId: number;
  /** Validator auth address, lowercased. */
  authAddress: string;
  /** Commission in basis points (500 = 5%). */
  commissionBps: number;
  /** Execution-view stake, in wei. */
  stakeWei: bigint;
  /** Stake active in consensus for the current epoch, in wei. */
  consensusStakeWei: bigint;
  /**
   * Unclaimed rewards held in this validator's pool for ALL of its delegators,
   * in wei. This is not the operator's commission: commission is credited to
   * the auth address as a delegator (see `getDelegator(id, authAddress)`).
   */
  unclaimedRewardsWei: bigint;
  /** Raw validator flags bitfield as returned by the precompile. */
  flags: bigint;
  /** Compressed secp256k1 pubkey, hex without 0x, or null if absent. */
  secpPubkey: string | null;
};

export type LiveSnapshot = {
  /** Block every read in this snapshot is pinned to. */
  blockNumber: number;
  epoch: number;
  inEpochDelayPeriod: boolean;
  /** ISO-8601 wall-clock time at which the snapshot finished. */
  fetchedAt: string;
  /** Number of ids returned by getExecutionValidatorSet. */
  validatorSetSize: number;
  validators: LiveValidator[];
  /** Ids whose getValidator read failed after retries. */
  failedIds: number[];
  /** True when every id in the set was read successfully. */
  complete: boolean;
};

type ValidatorTuple = readonly [
  `0x${string}`, // authAddress
  bigint, // flags
  bigint, // stake
  bigint, // accRewardPerToken
  bigint, // commission (1e18-scaled)
  bigint, // unclaimedRewards
  bigint, // consensusStake
  bigint, // consensusCommission
  bigint, // snapshotStake
  bigint, // snapshotCommission
  `0x${string}`, // secpPubkey
  `0x${string}`, // blsPubkey
];

/** Minimal chain-reading surface, so tests can inject a fake. */
export type SnapshotReader = {
  getBlockNumber(): Promise<bigint>;
  readContract(args: {
    address: `0x${string}`;
    abi: typeof STAKING_ABI;
    functionName: string;
    args?: readonly unknown[];
    blockNumber?: bigint;
  }): Promise<unknown>;
};

export type SnapshotOptions = {
  /** getValidator calls issued together. Public RPC allows 50 req/s. */
  chunkSize?: number;
  /** Pause between chunks, in ms. */
  chunkDelayMs?: number;
  /** Safety cap on getExecutionValidatorSet pages (100 ids per page). */
  maxPages?: number;
  reader?: SnapshotReader;
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_CHUNK_SIZE = 20;
const DEFAULT_CHUNK_DELAY_MS = 450;
const DEFAULT_MAX_PAGES = 50;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** commission is 1e18-scaled on-chain (10% = 1e17); 1 bps = 1e14. */
export function commissionToBps(commission: bigint): number {
  return Number(commission / 10n ** 14n);
}

function toLiveValidator(id: bigint, t: ValidatorTuple): LiveValidator {
  const secp = t[10];
  return {
    validatorId: Number(id),
    authAddress: t[0].toLowerCase(),
    flags: t[1],
    stakeWei: t[2],
    commissionBps: commissionToBps(t[4]),
    unclaimedRewardsWei: t[5],
    consensusStakeWei: t[6],
    secpPubkey: typeof secp === "string" && secp.length > 2 ? secp.slice(2).toLowerCase() : null,
  };
}

export async function readLiveSnapshot(opts: SnapshotOptions = {}): Promise<LiveSnapshot> {
  const reader = opts.reader ?? (getPublicClient() as unknown as SnapshotReader);
  const sleep = opts.sleep ?? defaultSleep;
  const chunkSize = Math.max(1, opts.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const chunkDelayMs = Math.max(0, opts.chunkDelayMs ?? DEFAULT_CHUNK_DELAY_MS);
  const maxPages = Math.max(1, opts.maxPages ?? DEFAULT_MAX_PAGES);

  const blockNumber = await reader.getBlockNumber();
  const base = { address: STAKING_PRECOMPILE, abi: STAKING_ABI, blockNumber } as const;

  const [epoch, inEpochDelayPeriod] = (await reader.readContract({
    ...base,
    functionName: "getEpoch",
  })) as readonly [bigint, boolean];

  // 1. Collect validator ids (paginated).
  const ids: bigint[] = [];
  let startIndex = 0;
  for (let page = 0; page < maxPages; page++) {
    const [isDone, nextIndex, valIds] = (await reader.readContract({
      ...base,
      functionName: "getExecutionValidatorSet",
      args: [startIndex],
    })) as readonly [boolean, number, readonly bigint[]];
    ids.push(...valIds);
    if (isDone || valIds.length === 0) break;
    startIndex = Number(nextIndex);
  }

  // 2. Read each validator, in paced chunks, retrying a failed read once.
  const validators: LiveValidator[] = [];
  const failedIds: number[] = [];

  const readOne = async (id: bigint): Promise<LiveValidator | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const t = (await reader.readContract({
          ...base,
          functionName: "getValidator",
          args: [id],
        })) as ValidatorTuple;
        return toLiveValidator(id, t);
      } catch {
        if (attempt === 0) await sleep(chunkDelayMs || 50);
      }
    }
    return null;
  };

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map(readOne));
    results.forEach((r, k) => {
      if (r) validators.push(r);
      else failedIds.push(Number(chunk[k]));
    });
    if (i + chunkSize < ids.length && chunkDelayMs > 0) await sleep(chunkDelayMs);
  }

  return {
    blockNumber: Number(blockNumber),
    epoch: Number(epoch),
    inEpochDelayPeriod,
    fetchedAt: new Date().toISOString(),
    validatorSetSize: ids.length,
    validators,
    failedIds,
    complete: failedIds.length === 0 && validators.length === ids.length,
  };
}

// ── Derived metrics (Class 2) ────────────────────────────────────────────────

/**
 * Nakamoto coefficient: the smallest number of validators whose combined stake
 * exceeds one third of total stake. Formula `nakamoto_coefficient v1.0`.
 */
export function nakamotoCoefficient(stakes: readonly bigint[]): number {
  const sorted = [...stakes].filter((s) => s > 0n).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  const total = sorted.reduce((a, b) => a + b, 0n);
  if (total === 0n) return 0;
  let cum = 0n;
  for (let i = 0; i < sorted.length; i++) {
    cum += sorted[i]!;
    if (cum * 3n > total) return i + 1;
  }
  return sorted.length;
}

const WEI_PER_MON = 10n ** 18n;

/** Wei → MON as a JS number, keeping 6 decimal places. */
export function weiToMon(wei: bigint): number {
  const whole = wei / WEI_PER_MON;
  const frac = wei % WEI_PER_MON;
  return Number(whole) + Number(frac / 10n ** 12n) / 1e6;
}

export type SnapshotSummary = {
  validatorSetSize: number;
  validatorsRead: number;
  totalConsensusStakeMon: number;
  totalStakeMon: number;
  nakamotoCoefficient: number;
  /** Share of consensus stake held by the largest validator, 0–100. */
  topValidatorSharePct: number;
  medianCommissionBps: number;
};

export function summarizeSnapshot(s: LiveSnapshot): SnapshotSummary {
  const consensus = s.validators.map((v) => v.consensusStakeWei);
  const totalConsensus = consensus.reduce((a, b) => a + b, 0n);
  const totalStake = s.validators.reduce((a, v) => a + v.stakeWei, 0n);
  const top = consensus.reduce((a, b) => (b > a ? b : a), 0n);
  const commissions = s.validators.map((v) => v.commissionBps).sort((a, b) => a - b);
  const mid = Math.floor(commissions.length / 2);
  const median =
    commissions.length === 0
      ? 0
      : commissions.length % 2 === 1
        ? commissions[mid]!
        : Math.round((commissions[mid - 1]! + commissions[mid]!) / 2);

  return {
    validatorSetSize: s.validatorSetSize,
    validatorsRead: s.validators.length,
    totalConsensusStakeMon: weiToMon(totalConsensus),
    totalStakeMon: weiToMon(totalStake),
    nakamotoCoefficient: nakamotoCoefficient(consensus),
    topValidatorSharePct:
      totalConsensus === 0n ? 0 : Number((top * 1_000_000n) / totalConsensus) / 10_000,
    medianCommissionBps: median,
  };
}

// ── In-memory cache ──────────────────────────────────────────────────────────

const FRESH_MS = 60_000;
/** How long a cached snapshot may stand in when a re-read fails or is partial. */
const STALE_MS = 10 * 60_000;
/** A read that has not settled after this long is abandoned and restarted. */
const INFLIGHT_MAX_MS = 45_000;

let cached: { value: LiveSnapshot; at: number } | null = null;
let inflight: { promise: Promise<LiveSnapshot>; startedAt: number } | null = null;

function usable(now: number): LiveSnapshot | null {
  return cached && now - cached.at < STALE_MS ? cached.value : null;
}

function refresh(): Promise<LiveSnapshot> {
  // Serverless runtimes freeze a function between requests, so a read that was
  // in flight when the instance froze may never settle. Do not wait on it.
  if (inflight && Date.now() - inflight.startedAt < INFLIGHT_MAX_MS) return inflight.promise;

  const entry: { promise: Promise<LiveSnapshot>; startedAt: number } = {
    startedAt: Date.now(),
    promise: readLiveSnapshot().then(
      (value) => {
        if (inflight === entry) inflight = null;
        // A partial read does not replace a complete one that is still recent.
        // Once the complete one is too old, the partial read (flagged
        // complete: false) is the honest answer.
        const previous = usable(Date.now());
        if (!value.complete && previous?.complete) return previous;
        cached = { value, at: Date.now() };
        return value;
      },
      (err: unknown) => {
        if (inflight === entry) inflight = null;
        throw err;
      }
    ),
  };
  inflight = entry;
  return entry.promise;
}

/**
 * Cached snapshot. Served from memory for 60s; after that the chain is re-read
 * before answering. No background refresh: work started after a response is
 * sent is not guaranteed to finish on a serverless runtime. If the re-read
 * fails, a cached snapshot younger than 10 minutes is returned instead (its
 * `readAt` and `blockNumber` still say exactly how old it is).
 */
export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  const now = Date.now();
  if (cached && now - cached.at < FRESH_MS) return cached.value;
  try {
    return await refresh();
  } catch (err) {
    const previous = usable(Date.now());
    if (previous) return previous;
    throw err;
  }
}

/** Test hook: drop the in-memory cache. */
export function __resetLiveSnapshotCache(): void {
  cached = null;
  inflight = null;
}
