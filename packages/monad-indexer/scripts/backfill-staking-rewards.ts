/**
 * Standalone backfill script: indexes the last 7 days of mainnet staking reward events.
 *
 * Run on VPS:
 *   npx tsx --env-file=/opt/purpleiris/.env scripts/backfill-staking-rewards.ts
 *
 * With public RPC override (recommended for long backfills):
 *   MONAD_MAINNET_RPC_URL=https://rpc.monad.xyz npx tsx --env-file=/opt/purpleiris/.env scripts/backfill-staking-rewards.ts
 *
 * Test mode (last 2000 blocks):
 *   INDEXER_TEST_BLOCKS=2000 npx tsx --env-file=/opt/purpleiris/.env scripts/backfill-staking-rewards.ts
 *
 * Resumes automatically from MAX(block_number) already in the DB.
 * ON CONFLICT DO NOTHING handles duplicate inserts.
 */
import "dotenv/config";
import { createPublicClient, http } from "viem";
import { sql } from "drizzle-orm";
import { monadMainnet, MONAD_MAINNET_RPC_URL } from "../src/config";
import { backfillStakingRewards } from "../src/staking-rewards-indexer";
import { getDb } from "../src/db/client";
import { validatorStakingRewards } from "../src/db/schema";

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
  console.log(`[backfill-sr] current head: ${currentHead}`);

  const db = getDb();
  const maxIndexedResult = await db
    .select({ maxBlock: sql<string>`MAX(block_number)` })
    .from(validatorStakingRewards);
  const maxIndexed = maxIndexedResult[0]?.maxBlock ? BigInt(maxIndexedResult[0].maxBlock) : null;

  const windowStart = currentHead > SEVEN_DAYS_BLOCKS ? currentHead - SEVEN_DAYS_BLOCKS + 1n : 1n;

  let fromBlock: bigint;
  if (maxIndexed !== null && maxIndexed >= windowStart) {
    fromBlock = maxIndexed + 1n;
    console.log(`[backfill-sr] resuming from block ${fromBlock} (last indexed: ${maxIndexed})`);
  } else {
    fromBlock = windowStart;
    console.log(`[backfill-sr] starting fresh — 7-day window begins at block ${fromBlock}`);
  }

  let toBlock = currentHead;
  if (TEST_BLOCKS !== null) {
    const testFrom = currentHead - BigInt(TEST_BLOCKS) + 1n;
    fromBlock = testFrom > fromBlock ? testFrom : fromBlock;
    console.log(
      `[backfill-sr] TEST MODE — only last ${TEST_BLOCKS} blocks: ${fromBlock}→${toBlock}`
    );
  }

  if (fromBlock > toBlock) {
    console.log("[backfill-sr] nothing to index — already at head");
    return;
  }

  console.log(`[backfill-sr] range: ${fromBlock}→${toBlock} (${toBlock - fromBlock + 1n} blocks)`);
  console.log(
    `[backfill-sr] settings: INDEXER_CONCURRENCY=${process.env["INDEXER_CONCURRENCY"] ?? 1} ` +
      `INDEXER_MAX_RPS=${process.env["INDEXER_MAX_RPS"] ?? 5} ` +
      `INDEXER_INTER_DELAY_MS=${process.env["INDEXER_INTER_DELAY_MS"] ?? 350}`
  );
  console.log(`[backfill-sr] starting...`);

  const startMs = Date.now();
  await backfillStakingRewards(fromBlock, toBlock);
  const elapsedS = ((Date.now() - startMs) / 1000).toFixed(1);

  const finalCount = await db
    .select({ count: sql<string>`COUNT(*)`, maxB: sql<string>`MAX(block_number)` })
    .from(validatorStakingRewards);
  console.log(
    `[backfill-sr] finished in ${elapsedS}s — ` +
      `${finalCount[0]?.count ?? "?"} total rows, ` +
      `last indexed block: ${finalCount[0]?.maxB ?? "?"}`
  );
}

main().catch((err) => {
  console.error("[backfill-sr] fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
