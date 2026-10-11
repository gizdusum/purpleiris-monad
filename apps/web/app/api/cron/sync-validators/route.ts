// GET /api/cron/sync-validators
//
// Self-healing refresh of the `validators` table from the staking precompile.
// Triggered by Vercel Cron (see vercel.json). It needs no secret: the sync is
// idempotent, only reads the chain, and is throttled by the table's own
// freshness, so calling it more often than the throttle does nothing.

import { syncValidatorsFromChain } from "@purpleiris/monad-indexer";
import { apiJson } from "@/lib/api-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

export async function GET() {
  try {
    const result = await syncValidatorsFromChain();
    if (result.status === "synced") {
      console.log(
        `[sync-validators] upserted ${result.upserted}, deactivated ${result.deactivated} at block ${result.blockNumber}`
      );
    }
    return apiJson(result);
  } catch (err) {
    console.error("[sync-validators] failed:", err);
    return apiJson({ status: "error" }, { status: 503 });
  }
}
