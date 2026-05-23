import { createPublicClient, http, HttpRequestError } from "viem";
import { monadMainnet, MONAD_MAINNET_RPC_URL } from "./config";
import { getDb } from "./db/client";
import { validatorStakingRewards } from "./db/schema";
import { getValidatorsFromChain } from "./validators";
import { sql } from "drizzle-orm";

// Event topic[0] prefix for the per-block proposer reward event from staking precompile
const PROPOSER_REWARD_TOPIC_PREFIX = "0x3a420a01";
const STAKING_PRECOMPILE = "0x0000000000000000000000000000000000001000" as const;

// Alchemy hard limit for eth_getLogs range
const LOGS_BATCH_SIZE = 1000;
// DB insert batch — keep under Neon HTTP payload limit (~3500 params max).
// Each row uses 7 params; 500 rows = 3500 params, safely below the limit.
const DB_BATCH_SIZE = 500;
const MAX_RETRIES = 6;

const INTER_BATCH_DELAY_MS = parseInt(process.env["INDEXER_INTER_DELAY_MS"] ?? "350");
const MAX_RPS = parseFloat(process.env["INDEXER_MAX_RPS"] ?? "5");

// ── Rate Limiter ──────────────────────────────────────────────────────────────
class RateLimiter {
  private nextSlot: number;
  private readonly intervalMs: number;

  constructor(rps: number) {
    this.intervalMs = 1000 / rps;
    this.nextSlot = Date.now();
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    if (this.nextSlot < now) this.nextSlot = now;
    const slot = this.nextSlot;
    this.nextSlot += this.intervalMs;
    const delay = slot - now;
    if (delay > 0) {
      await new Promise<void>((r) => setTimeout(r, delay));
    }
  }
}

const rateLimiter = new RateLimiter(MAX_RPS);

// ── 429 helpers ───────────────────────────────────────────────────────────────

function is429(err: unknown): boolean {
  if (err instanceof HttpRequestError && err.status === 429) return true;
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status: unknown }).status === 429
  )
    return true;
  const msg = String(err);
  return (
    msg.includes("429") ||
    msg.toLowerCase().includes("too many requests") ||
    msg.toLowerCase().includes("rate limit")
  );
}

function getRetryAfterMs(err: unknown): number | null {
  try {
    if (err instanceof HttpRequestError) {
      const val = err.headers?.get("retry-after");
      if (val) {
        const secs = parseInt(val, 10);
        if (!isNaN(secs)) return secs * 1000;
      }
    }
  } catch {
    // fall through
  }
  return null;
}

// ── RPC client ────────────────────────────────────────────────────────────────

function getRpcClient() {
  return createPublicClient({
    chain: monadMainnet,
    transport: http(MONAD_MAINNET_RPC_URL, {
      timeout: 30_000,
      retryCount: 0,
    }),
  });
}

// ── Raw RPC types ─────────────────────────────────────────────────────────────

type RawLog = {
  address: string;
  topics: string[];
  data: string;
  blockNumber: `0x${string}`;
  blockHash: string;
  transactionIndex: `0x${string}`;
  logIndex: `0x${string}`;
  transactionHash: string;
  removed?: boolean;
};

// ── Validator map builder ─────────────────────────────────────────────────────

type ValidatorInfo = {
  authAddress: string;
  commissionBps: number;
};

async function buildOnchainIdMap(): Promise<Map<bigint, ValidatorInfo>> {
  const validators = await getValidatorsFromChain();
  const map = new Map<bigint, ValidatorInfo>();
  for (const v of validators) {
    if (v.validatorId !== undefined) {
      map.set(v.validatorId, { authAddress: v.address, commissionBps: v.commissionBps });
    }
  }
  return map;
}

// ── Log fetcher with retry ────────────────────────────────────────────────────

async function fetchLogsWithRetry(
  client: ReturnType<typeof getRpcClient>,
  fromBlock: bigint,
  toBlock: bigint
): Promise<RawLog[]> {
  const backoffMs = [2000, 4000, 8000, 16000, 32000, 60000];
  const hexFrom = ("0x" + fromBlock.toString(16)) as `0x${string}`;
  const hexTo = ("0x" + toBlock.toString(16)) as `0x${string}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await rateLimiter.acquire();
      const logs = (await client.request({
        method: "eth_getLogs" as Parameters<typeof client.request>[0]["method"],
        params: [
          {
            address: STAKING_PRECOMPILE,
            fromBlock: hexFrom,
            toBlock: hexTo,
          },
        ] as unknown as [`0x${string}`],
      })) as RawLog[];
      return logs ?? [];
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        const msg = err instanceof Error ? err.message.split("\n")[0]?.trim() : String(err);
        console.warn(
          `[staking-rewards] blocks ${fromBlock}-${toBlock} failed after ${MAX_RETRIES} retries — skipping (${msg?.slice(0, 80)})`
        );
        return [];
      }
      const is429err = is429(err);
      const retryAfterMs = is429err ? getRetryAfterMs(err) : null;
      const delay = retryAfterMs ?? backoffMs[attempt] ?? 60000;
      const reason = is429err ? "rate limited" : "fetch error";
      const errDetail =
        err instanceof Error
          ? `${err.constructor.name}: ${err.message.split("\n")[0]?.trim().slice(0, 200)}`
          : String(err).slice(0, 200);
      console.log(
        `[staking-rewards] ${reason} at ${fromBlock}-${toBlock}, backing off ${(delay / 1000).toFixed(0)}s (retry ${attempt + 1}/${MAX_RETRIES}) — ${errDetail}`
      );
      await new Promise<void>((r) => setTimeout(r, delay));
    }
  }
  return [];
}

// ── Log parser ────────────────────────────────────────────────────────────────

type ParsedReward = {
  onchainValidatorId: bigint;
  validatorAuthAddress: string;
  blockNumber: bigint;
  blockTimestamp: Date;
  grossRewardWei: bigint;
  commissionEarnedWei: bigint;
  epoch: bigint;
};

function parseRewardLog(
  log: RawLog,
  blockTimestamps: Map<bigint, Date>,
  onchainIdMap: Map<bigint, ValidatorInfo>
): ParsedReward | null {
  // Filter: must be proposer reward event
  if (!log.topics[0]?.startsWith(PROPOSER_REWARD_TOPIC_PREFIX)) return null;
  if (log.topics.length < 2) return null;
  if (log.removed) return null;

  const onchainId = BigInt(log.topics[1]!);
  const info = onchainIdMap.get(onchainId);
  if (!info) return null; // unknown validator

  const data = log.data;
  if (!data || data.length < 130) return null; // need at least 64 bytes of data

  const grossRewardWei = BigInt("0x" + data.slice(2, 66));
  const epoch = BigInt("0x" + data.slice(66, 130));

  const commissionEarnedWei = (grossRewardWei * BigInt(info.commissionBps)) / 10000n;

  const blockNum = BigInt(log.blockNumber);
  const blockTs = blockTimestamps.get(blockNum) ?? new Date(0);

  return {
    onchainValidatorId: onchainId,
    validatorAuthAddress: info.authAddress,
    blockNumber: blockNum,
    blockTimestamp: blockTs,
    grossRewardWei,
    commissionEarnedWei,
    epoch,
  };
}

// ── Block timestamp estimation ────────────────────────────────────────────────
// Fetches ONE anchor block per window, then estimates all others by linear interpolation.
// Monad target block time is ~400ms. Error is ≤ 400s per 1000 blocks, negligible
// for 7d/24h time-range queries. Reduces from 1000 RPC calls/window to 1.

const MONAD_BLOCK_MS = 400;

async function fetchAnchorTimestamp(
  client: ReturnType<typeof getRpcClient>,
  blockNum: bigint
): Promise<Date> {
  const hex = ("0x" + blockNum.toString(16)) as `0x${string}`;
  try {
    await rateLimiter.acquire();
    const block = (await client.request({
      method: "eth_getBlockByNumber" as Parameters<typeof client.request>[0]["method"],
      params: [hex, false] as unknown as [`0x${string}`],
    })) as { timestamp: string } | null;
    if (block) {
      return new Date(Number(BigInt(block.timestamp)) * 1000);
    }
  } catch {
    // fall through — use current time as rough anchor
  }
  return new Date();
}

function estimateBlockTimestamps(
  logs: RawLog[],
  anchorBlock: bigint,
  anchorTs: Date
): Map<bigint, Date> {
  const map = new Map<bigint, Date>();
  for (const log of logs) {
    const bn = BigInt(log.blockNumber);
    const offsetMs = Number(bn - anchorBlock) * MONAD_BLOCK_MS;
    map.set(bn, new Date(anchorTs.getTime() + offsetMs));
  }
  return map;
}

// ── DB insert helper ──────────────────────────────────────────────────────────

async function flushRows(rows: ParsedReward[]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb();
  await db
    .insert(validatorStakingRewards)
    .values(
      rows.map((r) => ({
        onchainValidatorId: r.onchainValidatorId,
        validatorAuthAddress: r.validatorAuthAddress,
        blockNumber: r.blockNumber,
        blockTimestamp: r.blockTimestamp,
        grossRewardWei: r.grossRewardWei.toString(),
        commissionEarnedWei: r.commissionEarnedWei.toString(),
        epoch: r.epoch,
      }))
    )
    .onConflictDoNothing();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function backfillStakingRewards(fromBlock: bigint, toBlock: bigint): Promise<void> {
  const client = getRpcClient();

  console.log(
    `[staking-rewards] backfill ${fromBlock}→${toBlock} (${toBlock - fromBlock + 1n} blocks) ` +
      `| max_rps=${MAX_RPS} inter_delay=${INTER_BATCH_DELAY_MS}ms`
  );

  const onchainIdMap = await buildOnchainIdMap();
  console.log(`[staking-rewards] onchain_id map: ${onchainIdMap.size} validators`);

  if (onchainIdMap.size === 0) {
    console.error("[staking-rewards] no validators found — is DB populated?");
    return;
  }

  let pendingRows: ParsedReward[] = [];
  let totalIndexed = 0;
  const PROGRESS_EVERY = 100_000n; // log progress every N blocks
  let lastProgressAt = fromBlock;

  for (let batchStart = fromBlock; batchStart <= toBlock; batchStart += BigInt(LOGS_BATCH_SIZE)) {
    const batchEnd =
      batchStart + BigInt(LOGS_BATCH_SIZE) - 1n < toBlock
        ? batchStart + BigInt(LOGS_BATCH_SIZE) - 1n
        : toBlock;

    const logs = await fetchLogsWithRetry(client, batchStart, batchEnd);

    if (logs.length > 0) {
      const anchorTs = await fetchAnchorTimestamp(client, batchStart);
      const timestamps = estimateBlockTimestamps(logs, batchStart, anchorTs);

      for (const log of logs) {
        const parsed = parseRewardLog(log, timestamps, onchainIdMap);
        if (parsed) pendingRows.push(parsed);
      }
    }

    if (pendingRows.length >= DB_BATCH_SIZE || batchEnd >= toBlock) {
      await flushRows(pendingRows);
      totalIndexed += pendingRows.length;
      if (pendingRows.length > 0) {
        console.log(
          `[staking-rewards] block ${batchEnd} — flushed ${pendingRows.length} rows (total: ${totalIndexed})`
        );
      }
      pendingRows = [];
    }

    if (batchStart - lastProgressAt >= PROGRESS_EVERY) {
      const pct = ((Number(batchStart - fromBlock) / Number(toBlock - fromBlock)) * 100).toFixed(1);
      console.log(`[staking-rewards] progress: ${batchStart}/${toBlock} (${pct}%)`);
      lastProgressAt = batchStart;
    }

    await new Promise<void>((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
  }

  console.log(`[staking-rewards] backfill complete. ${totalIndexed} reward rows indexed.`);
}

export async function syncRecentStakingRewards(): Promise<void> {
  const client = getRpcClient();
  const db = getDb();

  const currentHead = await client.getBlockNumber();
  const maxIndexedResult = await db
    .select({ maxBlock: sql<string>`MAX(block_number)` })
    .from(validatorStakingRewards);

  const maxIndexed = maxIndexedResult[0]?.maxBlock ? BigInt(maxIndexedResult[0].maxBlock) : null;

  if (maxIndexed === null) {
    console.log("[staking-rewards] no data yet — run backfill first");
    return;
  }

  const fromBlock = maxIndexed + 1n;
  if (fromBlock > currentHead) {
    console.log("[staking-rewards] already at head, nothing to sync");
    return;
  }

  console.log(
    `[staking-rewards] sync: ${fromBlock}→${currentHead} (${currentHead - fromBlock + 1n} blocks)`
  );
  await backfillStakingRewards(fromBlock, currentHead);
}
