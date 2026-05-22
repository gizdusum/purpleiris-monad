import { createPublicClient, http, HttpRequestError } from "viem";
import { monadMainnet, MONAD_MAINNET_RPC_URL } from "./config";
import { getDb } from "./db/client";
import { validators, validatorExecutionRevenue } from "./db/schema";
import { sql } from "drizzle-orm";

const STAKING_PRECOMPILE = "0x0000000000000000000000000000000000001000" as const;
const PROTOCOL_ADDR = "0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e" as const;
const BATCH_SIZE = 500; // blocks per DB insert batch
const MAX_RETRIES = 6; // per-block 429 retry limit

const RPC_CONCURRENCY = parseInt(process.env["INDEXER_CONCURRENCY"] ?? "1");
const INTER_PAIR_DELAY_MS = parseInt(process.env["INDEXER_INTER_DELAY_MS"] ?? "350");
const BATCH_DELAY_MS = parseInt(process.env["INDEXER_BATCH_DELAY_MS"] ?? "200");
const MAX_RPS = parseFloat(process.env["INDEXER_MAX_RPS"] ?? "5");
const PROGRESS_EVERY = 50_000; // log progress every N blocks

// ── Rate Limiter ─────────────────────────────────────────────────────────────
// Leaky-bucket: spreads exactly MAX_RPS requests/second across all concurrent
// workers. acquire() is sync-safe — JS single-threaded guarantees atomic slot
// reservation before any await.
class RateLimiter {
  private nextSlot: number;
  private readonly intervalMs: number;

  constructor(rps: number) {
    this.intervalMs = 1000 / rps;
    this.nextSlot = Date.now();
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    if (this.nextSlot < now) this.nextSlot = now; // reset after idle
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
  // duck-type check for viem errors across dual module instances
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
    // headers API unavailable — fall through to exponential backoff
  }
  return null;
}

// ── RPC client ────────────────────────────────────────────────────────────────

function getRpcClient() {
  return createPublicClient({
    chain: monadMainnet,
    transport: http(MONAD_MAINNET_RPC_URL, {
      timeout: 15_000,
      retryCount: 0, // disable viem retries — our own retry wrapper handles everything
    }),
  });
}

// ── System-tx helpers ─────────────────────────────────────────────────────────

function isSystemTx(tx: {
  to?: string | null;
  from?: string | null;
  gasPrice?: bigint | null;
  gas?: bigint;
}): boolean {
  const to = (tx.to ?? "").toLowerCase();
  const from = (tx.from ?? "").toLowerCase();
  const gasPrice = tx.gasPrice ?? 0n;
  const gas = tx.gas ?? 0n;
  return (
    to === STAKING_PRECOMPILE.toLowerCase() ||
    from === PROTOCOL_ADDR.toLowerCase() ||
    (gasPrice === 0n && gas === 0n)
  );
}

function extractProposerSecpAddr(
  txs: Array<{
    to?: string | null;
    from?: string | null;
    gasPrice?: bigint | null;
    gas?: bigint;
    input?: string;
  }>
): string | null {
  const systemTxs = txs.filter(isSystemTx);
  if (systemTxs.length > 1) {
    console.warn(`[execution-revenue] unexpected: ${systemTxs.length} system txs in block`);
  }
  const sysTx = systemTxs[0];
  if (!sysTx?.input || sysTx.input.length < 74) return null;
  return "0x" + sysTx.input.slice(-40);
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function buildSecpAddrMap(): Promise<Map<string, string>> {
  const db = getDb();
  const rows = await db
    .select({ id: validators.id, secpAddr: validators.secpAddr })
    .from(validators)
    .where(sql`${validators.secpAddr} IS NOT NULL`);

  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.secpAddr) {
      map.set(row.secpAddr.toLowerCase(), row.id);
    }
  }
  return map;
}

// ── Per-block fetch ───────────────────────────────────────────────────────────

type BlockRevenue = {
  validatorId: string;
  feeRevenueWei: bigint;
  txCount: number;
  blockTimestamp: Date;
};

async function fetchBlockRevenue(
  client: ReturnType<typeof getRpcClient>,
  blockNumber: bigint,
  secpAddrMap: Map<string, string>
): Promise<BlockRevenue | null> {
  // Both RPC calls count against the rate limiter independently
  const [block, receipts] = await Promise.all([
    rateLimiter.acquire().then(() => client.getBlock({ blockNumber, includeTransactions: true })),
    rateLimiter.acquire().then(
      () =>
        client.request({
          method: "eth_getBlockReceipts" as Parameters<typeof client.request>[0]["method"],
          params: [("0x" + blockNumber.toString(16)) as `0x${string}`],
        }) as Promise<Array<{
          gasUsed: `0x${string}`;
          effectiveGasPrice: `0x${string}`;
          transactionIndex: `0x${string}`;
        }> | null>
    ),
  ]);

  if (!block || !receipts) return null;

  const baseFeePerGas = block.baseFeePerGas ?? 0n;
  const txs = block.transactions as Array<{
    to?: string | null;
    from?: string | null;
    gasPrice?: bigint | null;
    gas?: bigint;
    input?: string;
  }>;

  const proposerSecpAddr = extractProposerSecpAddr(txs);
  if (!proposerSecpAddr) return null;

  const validatorId = secpAddrMap.get(proposerSecpAddr.toLowerCase());
  if (!validatorId) return null;

  let feeRevenueWei = 0n;
  let txCount = 0;

  for (const receipt of receipts) {
    const gasUsed = BigInt(receipt.gasUsed);
    const effectiveGasPrice = BigInt(receipt.effectiveGasPrice);
    if (gasUsed === 0n && effectiveGasPrice === 0n) continue;
    const priorityFee = effectiveGasPrice > baseFeePerGas ? effectiveGasPrice - baseFeePerGas : 0n;
    feeRevenueWei += gasUsed * priorityFee;
    txCount++;
  }

  return {
    validatorId,
    feeRevenueWei,
    txCount,
    blockTimestamp: new Date(Number(block.timestamp) * 1000),
  };
}

// Retry wrapper — retries ALL errors (429 and other transient RPC failures).
// Any exception from fetchBlockRevenue is transient: viem returns null (not throw) for
// non-existent blocks, so exceptions always mean a network / rate-limit issue worth retrying.
async function fetchBlockRevenueWithRetry(
  client: ReturnType<typeof getRpcClient>,
  blockNumber: bigint,
  secpAddrMap: Map<string, string>
): Promise<BlockRevenue | null> {
  const backoffMs = [2000, 4000, 8000, 16000, 32000, 60000];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchBlockRevenue(client, blockNumber, secpAddrMap);
    } catch (err) {
      if (attempt >= MAX_RETRIES) {
        const msg = err instanceof Error ? err.message.split("\n")[0]?.trim() : String(err);
        console.warn(
          `[backfill] block ${blockNumber} failed after ${MAX_RETRIES} retries — skipping (${msg?.slice(0, 80)})`
        );
        return null;
      }
      const is429err = is429(err);
      const retryAfterMs = is429err ? getRetryAfterMs(err) : null;
      const delay = retryAfterMs ?? backoffMs[attempt] ?? 60000;
      const reason = is429err ? "rate limited" : "fetch error";
      console.log(
        `[backfill] ${reason} at block ${blockNumber}, backing off ${(delay / 1000).toFixed(0)}s (retry ${attempt + 1}/${MAX_RETRIES})`
      );
      await new Promise<void>((r) => setTimeout(r, delay));
    }
  }

  return null;
}

// ── Batch processor ───────────────────────────────────────────────────────────

async function processBlockChunk(
  client: ReturnType<typeof getRpcClient>,
  blockNums: bigint[],
  secpAddrMap: Map<string, string>
): Promise<
  Array<{
    validatorId: string;
    blockNumber: bigint;
    blockTimestamp: Date;
    feeRevenueWei: bigint;
    txCount: number;
  }>
> {
  const results: Array<{
    validatorId: string;
    blockNumber: bigint;
    blockTimestamp: Date;
    feeRevenueWei: bigint;
    txCount: number;
  }> = [];

  for (let i = 0; i < blockNums.length; i += RPC_CONCURRENCY) {
    const slice = blockNums.slice(i, i + RPC_CONCURRENCY);
    const settled = await Promise.allSettled(
      slice.map((bn) => fetchBlockRevenueWithRetry(client, bn, secpAddrMap))
    );

    for (let j = 0; j < settled.length; j++) {
      const s = settled[j]!;
      const bn = slice[j]!;
      if (s.status === "fulfilled" && s.value !== null) {
        results.push({ blockNumber: bn, ...s.value });
      } else if (s.status === "rejected") {
        // Should not happen — fetchBlockRevenueWithRetry catches all errors internally
        const msg =
          s.reason instanceof Error ? s.reason.message.split("\n")[0]?.trim() : String(s.reason);
        console.warn(`[execution-revenue] block ${bn} unexpected rejection: ${msg?.slice(0, 100)}`);
      }
    }

    if (i + RPC_CONCURRENCY < blockNums.length) {
      await new Promise<void>((r) => setTimeout(r, INTER_PAIR_DELAY_MS));
    }
  }

  return results;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function backfillExecutionRevenue(fromBlock: bigint, toBlock: bigint): Promise<void> {
  const client = getRpcClient();
  const db = getDb();

  console.log(
    `[execution-revenue] backfill ${fromBlock}→${toBlock} (${toBlock - fromBlock + 1n} blocks) ` +
      `| concurrency=${RPC_CONCURRENCY} max_rps=${MAX_RPS} inter_delay=${INTER_PAIR_DELAY_MS}ms`
  );

  const secpAddrMap = await buildSecpAddrMap();
  console.log(`[execution-revenue] secp_addr map: ${secpAddrMap.size} validators`);

  if (secpAddrMap.size === 0) {
    console.error(
      "[execution-revenue] no validators with secp_addr — run populate-secp-addr first"
    );
    return;
  }

  let processedTotal = 0n;
  let lastProgressAt = fromBlock;

  for (let batchStart = fromBlock; batchStart <= toBlock; batchStart += BigInt(BATCH_SIZE)) {
    const batchEnd =
      batchStart + BigInt(BATCH_SIZE) - 1n < toBlock
        ? batchStart + BigInt(BATCH_SIZE) - 1n
        : toBlock;

    const blockNums: bigint[] = [];
    for (let bn = batchStart; bn <= batchEnd; bn++) {
      blockNums.push(bn);
    }

    const rows = await processBlockChunk(client, blockNums, secpAddrMap);

    if (rows.length > 0) {
      await db
        .insert(validatorExecutionRevenue)
        .values(
          rows.map((r) => ({
            validatorId: r.validatorId,
            blockNumber: r.blockNumber,
            blockTimestamp: r.blockTimestamp,
            feeRevenueWei: r.feeRevenueWei.toString(),
            txCount: r.txCount,
          }))
        )
        .onConflictDoNothing();

      console.log(
        `[execution-revenue] block ${batchEnd} indexed (${rows.length} blocks with revenue)`
      );
    }

    processedTotal += batchEnd - batchStart + 1n;

    if (batchStart - lastProgressAt >= BigInt(PROGRESS_EVERY)) {
      const pct = ((Number(batchStart - fromBlock) / Number(toBlock - fromBlock)) * 100).toFixed(1);
      console.log(`[execution-revenue] progress: ${batchStart}/${toBlock} (${pct}%)`);
      lastProgressAt = batchStart;
    }

    await new Promise<void>((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  console.log(`[execution-revenue] backfill complete. ${processedTotal} blocks processed.`);
}

export async function syncRecentExecutionRevenue(): Promise<void> {
  const client = getRpcClient();
  const db = getDb();

  const currentHead = await client.getBlockNumber();
  const maxIndexedResult = await db
    .select({ maxBlock: sql<string>`MAX(block_number)` })
    .from(validatorExecutionRevenue);

  const maxIndexed = maxIndexedResult[0]?.maxBlock ? BigInt(maxIndexedResult[0].maxBlock) : null;

  if (maxIndexed === null) {
    console.log("[execution-revenue] no data yet — run backfill first");
    return;
  }

  const fromBlock = maxIndexed + 1n;
  if (fromBlock > currentHead) {
    console.log("[execution-revenue] already at head, nothing to sync");
    return;
  }

  console.log(
    `[execution-revenue] sync: ${fromBlock}→${currentHead} (${currentHead - fromBlock + 1n} blocks)`
  );
  await backfillExecutionRevenue(fromBlock, currentHead);
}
