/**
 * Hourly sync: index new blocks since last indexed block.
 * Called by sync-execution-revenue.timer systemd timer.
 */
import "dotenv/config";
import { syncRecentExecutionRevenue } from "../src/execution-revenue-indexer";

syncRecentExecutionRevenue().catch((err) => {
  console.error("[sync-execution-revenue] fatal:", err);
  process.exit(1);
});
