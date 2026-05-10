// Indexer worker — runs as a separate process alongside the web app.
// Phase 1: logs a heartbeat every 60s. Monad RPC integration is added in Phase 2.

import { setTimeout } from "timers/promises";

const POLL_INTERVAL_MS = 60_000;

async function main() {
  console.log("[indexer] started");

  while (true) {
    console.log(`[indexer] tick at ${new Date().toISOString()}`);
    // TODO: fetch epoch data from Monad RPC, write to DB
    await setTimeout(POLL_INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});
