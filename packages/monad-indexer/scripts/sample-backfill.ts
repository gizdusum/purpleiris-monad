import "dotenv/config";
import { createPublicClient, http } from "viem";
import { monadMainnet, MONAD_MAINNET_RPC_URL } from "../src/config";
import { backfillExecutionRevenue } from "../src/execution-revenue-indexer";

async function main() {
  const client = createPublicClient({
    chain: monadMainnet,
    transport: http(MONAD_MAINNET_RPC_URL, { timeout: 15_000, retryCount: 3 }),
  });
  const head = await client.getBlockNumber();
  const from = head - 200n;
  console.log(`[sample] indexing ${from} → ${head} (200 blocks)`);
  await backfillExecutionRevenue(from, head);
}
main().catch(console.error);
