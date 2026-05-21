import { createPublicClient, http } from "viem";
import { monadMainnet, MONAD_MAINNET_RPC_URL } from "./config";
import { getDb } from "./db/client";
import { validators, validatorExecutionRevenue } from "./db/schema";
import { sql } from "drizzle-orm";

const STAKING_PRECOMPILE = "0x0000000000000000000000000000000000001000" as const;
const PROTOCOL_ADDR = "0x6f49a8f621353f12378d0046e7d7e4b9b249dc9e" as const;
const BATCH_SIZE = 500; // blocks per DB insert batch
// Rate limits: Alchemy free tier = 300 CU/sec (91 CU/block: getBlock=16 + getReceipts=75)
// Public rpc.monad.xyz has no CU billing — use INDEXER_CONCURRENCY/INDEXER_INTER_DELAY_MS to tune.
// Defaults are conservative (Alchemy-safe): 1 sequential block, 350ms delay → ~165 CU/sec.
// For public RPC backfill: INDEXER_CONCURRENCY=8 INDEXER_INTER_DELAY_MS=100
const RPC_CONCURRENCY = parseInt(process.env["INDEXER_CONCURRENCY"] ?? "1");
const INTER_PAIR_DELAY_MS = parseInt(process.env["INDEXER_INTER_DELAY_MS"] ?? "350");
const BATCH_DELAY_MS = parseInt(process.env["INDEXER_BATCH_DELAY_MS"] ?? "200");
const PROGRESS_EVERY = 50_000; // log progress every N blocks

function getRpcClient() {
  return createPublicClient({
    chain: monadMainnet,
    transport: http(MONAD_MAINNET_RPC_URL, {
      timeout: 15_000,
      retryCount: 3,
      retryDelay: ({ count }) => Math.min(1000 * 2 ** count, 8000),
    }),
  });
}

// Return true if this tx is a system/protocol transaction that should be excluded from fee revenue
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

// Extract the system tx secp_addr argument from a block's transactions
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
  // input: 0x<selector4bytes><padded_address32bytes>
  // secp_addr is the last 20 bytes of the 32-byte arg
  return "0x" + sysTx.input.slice(-40);
}

// Build secp_addr → validator_id lookup map from DB
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

// Fetch one block's revenue data with retry
async function fetchBlockRevenue(
  client: ReturnType<typeof getRpcClient>,
  blockNumber: bigint,
  secpAddrMap: Map<string, string>
): Promise<{
  validatorId: string;
  feeRevenueWei: bigint;
  txCount: number;
  blockTimestamp: Date;
} | null> {
  const [block, receipts] = await Promise.all([
    client.getBlock({ blockNumber, includeTransactions: true }),
    client.request({
      method: "eth_getBlockReceipts" as Parameters<typeof client.request>[0]["method"],
      params: [("0x" + blockNumber.toString(16)) as `0x${string}`],
    }) as Promise<Array<{
      gasUsed: `0x${string}`;
      effectiveGasPrice: `0x${string}`;
      transactionIndex: `0x${string}`;
    }> | null>,
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

  // Identify block proposer via system tx secp_addr
  const proposerSecpAddr = extractProposerSecpAddr(txs);
  if (!proposerSecpAddr) return null;

  const validatorId = secpAddrMap.get(proposerSecpAddr.toLowerCase());
  if (!validatorId) return null; // proposer not in our validator set, skip

  // Sum priority fees for all user txs
  let feeRevenueWei = 0n;
  let txCount = 0;

  for (const receipt of receipts) {
    const gasUsed = BigInt(receipt.gasUsed);
    const effectiveGasPrice = BigInt(receipt.effectiveGasPrice);
    if (gasUsed === 0n && effectiveGasPrice === 0n) continue; // system tx receipt, skip
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

// Process a chunk of block numbers with bounded concurrency and inter-pair delay
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
      slice.map((bn) => fetchBlockRevenue(client, bn, secpAddrMap))
    );

    for (let j = 0; j < settled.length; j++) {
      const s = settled[j]!;
      const bn = slice[j]!;
      if (s.status === "fulfilled" && s.value !== null) {
        results.push({ blockNumber: bn, ...s.value });
      } else if (s.status === "rejected") {
        console.warn(`[execution-revenue] block ${bn} fetch failed: ${String(s.reason)}`);
      }
    }

    // Inter-pair delay to stay under Alchemy 300 CU/sec limit
    if (i + RPC_CONCURRENCY < blockNums.length) {
      await new Promise((r) => setTimeout(r, INTER_PAIR_DELAY_MS));
    }
  }

  return results;
}

export async function backfillExecutionRevenue(fromBlock: bigint, toBlock: bigint): Promise<void> {
  const client = getRpcClient();
  const db = getDb();

  console.log(
    `[execution-revenue] backfill ${fromBlock}→${toBlock} (${toBlock - fromBlock + 1n} blocks)`
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
    }

    processedTotal += batchEnd - batchStart + 1n;

    if (batchStart - lastProgressAt >= BigInt(PROGRESS_EVERY)) {
      console.log(
        `[execution-revenue] progress: ${batchStart}/${toBlock} ` +
          `(${((Number(batchStart - fromBlock) / Number(toBlock - fromBlock)) * 100).toFixed(1)}%) ` +
          `rows inserted in this batch: ${rows.length}`
      );
      lastProgressAt = batchStart;
    }

    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
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
