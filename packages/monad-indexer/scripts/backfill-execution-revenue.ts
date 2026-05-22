/**
 * Standalone backfill script: indexes the last 7 days of mainnet block fee revenue.
 *
 * Run on VPS:
 *   npx tsx --env-file=/opt/purpleiris/.env scripts/backfill-execution-revenue.ts
 *
 * Test mode (last 2000 blocks):
 *   INDEXER_TEST_BLOCKS=2000 npx tsx --env-file=/opt/purpleiris/.env scripts/backfill-execution-revenue.ts
 *
 * Resumes automatically from MAX(block_number) already in the DB.
 * ON CONFLICT DO NOTHING handles any duplicate inserts.
 */
import "dotenv/config";
import { createPublicClient, http } from "viem";
import { sql } from "drizzle-orm";
import { monadMainnet, MONAD_MAINNET_RPC_URL } from "../src/config";
import { backfillExecutionRevenue } from "../src/execution-revenue-indexer";
import { getDb } from "../src/db/client";
import { validatorExecutionRevenue } from "../src/db/schema";

const BLOCK_TIME_MS = 400; // Monad mainnet: ~400ms block time
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_BLOCKS = BigInt(Math.ceil(SEVEN_DAYS_MS / BLOCK_TIME_MS)); // ~1,512,000

const TEST_BLOCKS = process.env["INDEXER_TEST_BLOCKS"]
  ? parseInt(process.env["INDEXER_TEST_BLOCKS"], 10)
  : null;

async function main() {
  const client = createPublicClient({
    chain: monadMainnet,
    transport: http(MONAD_MAINNET_RPC_URL, { timeout: 15_000, retryCount: 3 }),
  });

  const currentHead = await client.getBlockNumber();
  console.log(`[backfill] current head: ${currentHead}`);

  // Resumability: start from MAX(block_number)+1 already indexed, not from 7 days ago
  const db = getDb();
  const maxIndexedResult = await db
    .select({ maxBlock: sql<string>`MAX(block_number)` })
    .from(validatorExecutionRevenue);
  const maxIndexed = maxIndexedResult[0]?.maxBlock ? BigInt(maxIndexedResult[0].maxBlock) : null;

  const windowStart = currentHead > SEVEN_DAYS_BLOCKS ? currentHead - SEVEN_DAYS_BLOCKS + 1n : 1n;

  let fromBlock: bigint;
  if (maxIndexed !== null && maxIndexed >= windowStart) {
    fromBlock = maxIndexed + 1n;
    console.log(`[backfill] resuming from block ${fromBlock} (last indexed: ${maxIndexed})`);
  } else {
    fromBlock = windowStart;
    console.log(`[backfill] starting fresh — 7-day window begins at block ${fromBlock}`);
  }

  // Test mode: clamp to last TEST_BLOCKS from head
  let toBlock = currentHead;
  if (TEST_BLOCKS !== null) {
    const testFrom = currentHead - BigInt(TEST_BLOCKS) + 1n;
    fromBlock = testFrom > fromBlock ? testFrom : fromBlock;
    console.log(`[backfill] TEST MODE — only last ${TEST_BLOCKS} blocks: ${fromBlock}→${toBlock}`);
  }

  if (fromBlock > toBlock) {
    console.log("[backfill] nothing to index — already at head");
    return;
  }

  console.log(`[backfill] range: ${fromBlock}→${toBlock} (${toBlock - fromBlock + 1n} blocks)`);
  console.log(
    `[backfill] settings: INDEXER_CONCURRENCY=${process.env["INDEXER_CONCURRENCY"] ?? 1} ` +
      `INDEXER_MAX_RPS=${process.env["INDEXER_MAX_RPS"] ?? 8} ` +
      `INDEXER_INTER_DELAY_MS=${process.env["INDEXER_INTER_DELAY_MS"] ?? 350}`
  );
  console.log(`[backfill] starting...`);

  const startMs = Date.now();
  await backfillExecutionRevenue(fromBlock, toBlock);
  const elapsedS = ((Date.now() - startMs) / 1000).toFixed(1);

  // Final count
  const finalCount = await db
    .select({ count: sql<string>`COUNT(*)`, maxB: sql<string>`MAX(block_number)` })
    .from(validatorExecutionRevenue);
  console.log(
    `[backfill] finished in ${elapsedS}s — ` +
      `${finalCount[0]?.count ?? "?"} total rows, ` +
      `last indexed block: ${finalCount[0]?.maxB ?? "?"}`
  );
}

main().catch((err) => {
  console.error("[backfill] fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
