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

// ── High-water-mark loader ────────────────────────────────────────────────────
// Loads the last committed block per (validator_id, day) from the DB into a
// Map<"validatorId:day", bigint>. Used by accumulateLog to skip events that
// have already been counted, making additive upserts idempotent on re-runs.
// Guarantees: a block processed in a prior run is never double-counted.
// Limitation: two CONCURRENT processes with overlapping ranges can still race;
// prevent this operationally by stopping the sync timer before running backfill.

async function loadHighWaterMarks(): Promise<Map<string, bigint>> {
  const db = getDb();
  const rows = await db
    .select({
      validatorId: validatorStakingRewards.validatorId,
      day: validatorStakingRewards.day,
      lastBlockNumber: validatorStakingRewards.lastBlockNumber,
    })
    .from(validatorStakingRewards);

  const hwm = new Map<string, bigint>();
  for (const row of rows) {
    if (row.lastBlockNumber !== null) {
      hwm.set(`${row.validatorId}:${row.day}`, row.lastBlockNumber);
    }
  }
  return hwm;
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

// ── UTC day helper ────────────────────────────────────────────────────────────

function toUtcDay(ts: Date): string {
  return ts.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// ── Daily aggregate types ─────────────────────────────────────────────────────

type DayAggregate = {
  validatorId: bigint;
  validatorAuthAddress: string;
  day: string; // 'YYYY-MM-DD'
  grossRewardWei: bigint;
  commissionEarnedWei: bigint;
  blocksProposed: number;
  epochMin: bigint;
  epochMax: bigint;
  lastBlockNumber: bigint;
};

function accumulateLog(
  log: RawLog,
  blockTimestamps: Map<bigint, Date>,
  onchainIdMap: Map<bigint, ValidatorInfo>,
  dayMap: Map<string, DayAggregate>,
  hwm: Map<string, bigint>
): void {
  if (!log.topics[0]?.startsWith(PROPOSER_REWARD_TOPIC_PREFIX)) return;
  if (log.topics.length < 2) return;
  if (log.removed) return;

  const onchainId = BigInt(log.topics[1]!);
  const info = onchainIdMap.get(onchainId);
  if (!info) return;

  const data = log.data;
  if (!data || data.length < 130) return;

  const grossRewardWei = BigInt("0x" + data.slice(2, 66));
  const epoch = BigInt("0x" + data.slice(66, 130));
  const commissionEarnedWei = (grossRewardWei * BigInt(info.commissionBps)) / 10000n;

  const blockNum = BigInt(log.blockNumber);
  const blockTs = blockTimestamps.get(blockNum) ?? new Date();
  const day = toUtcDay(blockTs);

  const key = `${onchainId}:${day}`;

  // Skip blocks already committed to this day-row (idempotency via high-water-mark).
  const committedHwm = hwm.get(key);
  if (committedHwm !== undefined && blockNum <= committedHwm) return;
  const existing = dayMap.get(key);
  if (existing) {
    existing.grossRewardWei += grossRewardWei;
    existing.commissionEarnedWei += commissionEarnedWei;
    existing.blocksProposed += 1;
    if (epoch < existing.epochMin) existing.epochMin = epoch;
    if (epoch > existing.epochMax) existing.epochMax = epoch;
    if (blockNum > existing.lastBlockNumber) existing.lastBlockNumber = blockNum;
  } else {
    dayMap.set(key, {
      validatorId: onchainId,
      validatorAuthAddress: info.authAddress,
      day,
      grossRewardWei,
      commissionEarnedWei,
      blocksProposed: 1,
      epochMin: epoch,
      epochMax: epoch,
      lastBlockNumber: blockNum,
    });
  }
}

// ── DB upsert helper ──────────────────────────────────────────────────────────
// Additive upsert: safe because blocks are processed exactly once via resume cursor.
// Sub-batches to 200 rows (well within Neon HTTP limits). Retries transient errors.

const DB_SUB_BATCH = 200;
const DB_RETRY_DELAYS = [1000, 2000, 4000, 8000];

async function flushDayMap(dayMap: Map<string, DayAggregate>): Promise<void> {
  if (dayMap.size === 0) return;
  const db = getDb();
  const rows = [...dayMap.values()];

  for (let i = 0; i < rows.length; i += DB_SUB_BATCH) {
    const chunk = rows.slice(i, i + DB_SUB_BATCH);
    const values = chunk.map((agg) => ({
      validatorId: agg.validatorId,
      validatorAuthAddress: agg.validatorAuthAddress,
      day: agg.day,
      grossRewardWei: agg.grossRewardWei.toString(),
      commissionEarnedWei: agg.commissionEarnedWei.toString(),
      blocksProposed: agg.blocksProposed,
      epochMin: agg.epochMin,
      epochMax: agg.epochMax,
      lastBlockNumber: agg.lastBlockNumber,
    }));

    for (let attempt = 0; attempt <= DB_RETRY_DELAYS.length; attempt++) {
      try {
        await db
          .insert(validatorStakingRewards)
          .values(values)
          .onConflictDoUpdate({
            target: [validatorStakingRewards.validatorId, validatorStakingRewards.day],
            set: {
              grossRewardWei: sql`${validatorStakingRewards.grossRewardWei} + excluded.gross_reward_wei`,
              commissionEarnedWei: sql`${validatorStakingRewards.commissionEarnedWei} + excluded.commission_earned_wei`,
              blocksProposed: sql`${validatorStakingRewards.blocksProposed} + excluded.blocks_proposed`,
              epochMin: sql`LEAST(COALESCE(${validatorStakingRewards.epochMin}, excluded.epoch_min), excluded.epoch_min)`,
              epochMax: sql`GREATEST(COALESCE(${validatorStakingRewards.epochMax}, excluded.epoch_max), excluded.epoch_max)`,
              lastBlockNumber: sql`GREATEST(${validatorStakingRewards.lastBlockNumber}, excluded.last_block_number)`,
              updatedAt: sql`NOW()`,
            },
          });
        break;
      } catch (err) {
        if (attempt >= DB_RETRY_DELAYS.length) throw err;
        const delay = DB_RETRY_DELAYS[attempt] ?? 8000;
        const msg =
          err instanceof Error
            ? err.message.split("\n")[0]?.trim().slice(0, 80)
            : String(err).slice(0, 80);
        console.warn(
          `[staking-rewards] DB upsert retry ${attempt + 1}/${DB_RETRY_DELAYS.length} — ${msg}`
        );
        await new Promise<void>((r) => setTimeout(r, delay));
      }
    }
  }
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

  // Load high-water-marks so re-runs (resume after crash, accidental re-trigger)
  // never double-count blocks already committed in a prior run.
  const hwm = await loadHighWaterMarks();
  if (hwm.size > 0) {
    console.log(`[staking-rewards] loaded ${hwm.size} high-water-marks from DB`);
  }

  let totalRows = 0;
  let totalBlocks = 0;
  const PROGRESS_EVERY = 100_000n;
  let lastProgressAt = fromBlock;

  for (let batchStart = fromBlock; batchStart <= toBlock; batchStart += BigInt(LOGS_BATCH_SIZE)) {
    const batchEnd =
      batchStart + BigInt(LOGS_BATCH_SIZE) - 1n < toBlock
        ? batchStart + BigInt(LOGS_BATCH_SIZE) - 1n
        : toBlock;

    const logs = await fetchLogsWithRetry(client, batchStart, batchEnd);
    totalBlocks += Number(batchEnd - batchStart + 1n);

    const dayMap = new Map<string, DayAggregate>();

    if (logs.length > 0) {
      const anchorTs = await fetchAnchorTimestamp(client, batchStart);
      const timestamps = estimateBlockTimestamps(logs, batchStart, anchorTs);

      for (const log of logs) {
        accumulateLog(log, timestamps, onchainIdMap, dayMap, hwm);
      }
    }

    if (dayMap.size > 0) {
      await flushDayMap(dayMap);
      // Extend in-memory HWM so later windows in this run also skip committed blocks.
      for (const [key, agg] of dayMap) {
        const existing = hwm.get(key);
        if (existing === undefined || agg.lastBlockNumber > existing) {
          hwm.set(key, agg.lastBlockNumber);
        }
      }
      totalRows += dayMap.size;
      console.log(
        `[staking-rewards] block ${batchEnd} — flushed ${dayMap.size} day-rows from ${logs.length} events`
      );
    }

    if (batchStart - lastProgressAt >= PROGRESS_EVERY) {
      const pct = ((Number(batchStart - fromBlock) / Number(toBlock - fromBlock)) * 100).toFixed(1);
      console.log(`[staking-rewards] progress: ${batchStart}/${toBlock} (${pct}%)`);
      lastProgressAt = batchStart;
    }

    await new Promise<void>((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
  }

  console.log(
    `[staking-rewards] backfill complete. ${totalBlocks} blocks processed, ${totalRows} day-row upserts.`
  );
}

export async function syncRecentStakingRewards(): Promise<void> {
  const client = getRpcClient();
  const db = getDb();

  const currentHead = await client.getBlockNumber();
  const maxIndexedResult = await db
    .select({ maxBlock: sql<string>`MAX(last_block_number)` })
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
