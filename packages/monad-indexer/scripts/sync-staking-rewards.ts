/**
 * Hourly sync: indexes new staking reward events since last indexed block.
 *
 * Run by systemd timer — see deploy/systemd/sync-staking-rewards.{service,timer}
 */
import "dotenv/config";
import { syncRecentStakingRewards } from "../src/staking-rewards-indexer";

syncRecentStakingRewards().catch((err) => {
  console.error("[sync-sr] fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
