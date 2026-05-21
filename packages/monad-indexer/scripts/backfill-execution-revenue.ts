/**
 * Standalone backfill script: indexes the last 7 days of mainnet block fee revenue.
 *
 * Run: DATABASE_URL=... MONAD_MAINNET_RPC_URL=... pnpm tsx scripts/backfill-execution-revenue.ts
 */
import "dotenv/config";
import { createPublicClient, http } from "viem";
import { monadMainnet, MONAD_MAINNET_RPC_URL } from "../src/config";
import { backfillExecutionRevenue } from "../src/execution-revenue-indexer";

const BLOCK_TIME_MS = 400; // Monad mainnet: 400ms block time (verified)
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_BLOCKS = BigInt(Math.ceil(SEVEN_DAYS_MS / BLOCK_TIME_MS)); // 1,512,000

async function main() {
  const client = createPublicClient({
    chain: monadMainnet,
    transport: http(MONAD_MAINNET_RPC_URL, { timeout: 15_000, retryCount: 3 }),
  });

  const currentHead = await client.getBlockNumber();
  const fromBlock = currentHead > SEVEN_DAYS_BLOCKS ? currentHead - SEVEN_DAYS_BLOCKS + 1n : 1n;

  console.log(`[backfill] current head: ${currentHead}`);
  console.log(`[backfill] 7-day window: ${fromBlock} → ${currentHead}`);
  console.log(`[backfill] blocks to index: ${currentHead - fromBlock + 1n}`);
  console.log(`[backfill] estimated time at 400ms/block × 8 parallel: varies by RPC throughput`);
  console.log(`[backfill] starting...`);

  const startMs = Date.now();
  await backfillExecutionRevenue(fromBlock, currentHead);
  const elapsedS = ((Date.now() - startMs) / 1000).toFixed(0);

  console.log(`[backfill] finished in ${elapsedS}s`);
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
