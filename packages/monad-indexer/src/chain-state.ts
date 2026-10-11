import { getPublicClient } from "./client";
import { STAKING_PRECOMPILE } from "./config";
import { STAKING_ABI } from "./staking-abi";

/**
 * Chain head + staking epoch, read directly from Monad mainnet.
 *
 * `epoch` and `inEpochDelayPeriod` come from `getEpoch()` on the staking precompile
 * and are pinned to `blockNumber`, so the three values describe one consistent
 * point in time. Class 1 (on-chain, deterministic).
 */
export type ChainState = {
  blockNumber: number;
  epoch: number;
  inEpochDelayPeriod: boolean;
  /** ISO-8601 wall-clock time at which this state was read. */
  fetchedAt: string;
};

const TTL_MS = 5_000;
let cached: { value: ChainState; at: number } | null = null;
let inflight: Promise<ChainState> | null = null;

async function readChainState(): Promise<ChainState> {
  const client = getPublicClient();
  const blockNumber = await client.getBlockNumber();
  const [epoch, inEpochDelayPeriod] = (await client.readContract({
    address: STAKING_PRECOMPILE,
    abi: STAKING_ABI,
    functionName: "getEpoch",
    blockNumber,
  })) as readonly [bigint, boolean];

  return {
    blockNumber: Number(blockNumber),
    epoch: Number(epoch),
    inEpochDelayPeriod,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getChainState(opts: { maxAgeMs?: number } = {}): Promise<ChainState> {
  const maxAge = opts.maxAgeMs ?? TTL_MS;
  if (cached && Date.now() - cached.at < maxAge) return cached.value;
  if (inflight) return inflight;

  inflight = readChainState().then(
    (value) => {
      cached = { value, at: Date.now() };
      inflight = null;
      return value;
    },
    (err: unknown) => {
      inflight = null;
      throw err;
    }
  );
  return inflight;
}

/** Test hook: drop the in-memory cache. */
export function __resetChainStateCache(): void {
  cached = null;
  inflight = null;
}
