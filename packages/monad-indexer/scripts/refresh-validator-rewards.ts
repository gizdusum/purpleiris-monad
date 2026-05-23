/**
 * One-shot: fetches live unclaimed_rewards_wei + commission_bps + staked_amount
 * for all active validators from the staking precompile and writes them to DB.
 *
 * Run when unclaimed_rewards_wei is NULL (e.g., after adding the column):
 *   npx tsx --env-file=/opt/purpleiris/.env scripts/refresh-validator-rewards.ts
 */
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../src/db/client";
import { validators } from "../src/db/schema";
import { getValidatorsFromChain } from "../src/validators";

async function main() {
  console.log("[refresh-validator-rewards] fetching from chain...");
  const chainValidators = await getValidatorsFromChain();
  const db = getDb();
  const now = new Date();

  let updated = 0;
  for (const v of chainValidators) {
    await db
      .update(validators)
      .set({
        unclaimedRewardsWei:
          v.unclaimedRewards !== undefined ? v.unclaimedRewards.toString() : null,
        commissionBps: v.commissionBps,
        stakedAmount: v.stakedAmount.toString(),
        updatedAt: now,
      })
      .where(eq(validators.id, v.address.toLowerCase()));
    updated++;
  }

  console.log(
    `[refresh-validator-rewards] updated ${updated}/${chainValidators.length} validators`
  );

  const [check] = await db
    .select({
      withPending: sql<string>`COUNT(unclaimed_rewards_wei)`,
      maxPending: sql<string>`MAX(unclaimed_rewards_wei)`,
    })
    .from(validators);

  console.log(
    `[refresh-validator-rewards] verify: with_pending=${check?.withPending ?? 0}, max_pending=${check?.maxPending ?? "null"}`
  );
}

main().catch((err) => {
  console.error(
    "[refresh-validator-rewards] fatal:",
    err instanceof Error ? err.message : String(err)
  );
  process.exit(1);
});
