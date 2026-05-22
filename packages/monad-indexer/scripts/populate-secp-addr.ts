/**
 * One-time script: compute secp_addr for all validators that have secp_pubkey
 * but no secp_addr, and write the result to the validators table.
 *
 * Run: DATABASE_URL=... pnpm tsx scripts/populate-secp-addr.ts
 */
import "dotenv/config";
import { getDb } from "../src/db/client";
import { validators } from "../src/db/schema";
import { secpPubkeyToAddr } from "../src/secp-addr";
import { eq, sql } from "drizzle-orm";

async function main() {
  const db = getDb();

  const rows = await db
    .select({ id: validators.id, secpPubkey: validators.secpPubkey })
    .from(validators)
    .where(sql`${validators.secpPubkey} IS NOT NULL AND ${validators.secpAddr} IS NULL`);

  console.log(`[populate-secp-addr] ${rows.length} validators need secp_addr computed`);

  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.secpPubkey) continue;
    try {
      const addr = secpPubkeyToAddr(row.secpPubkey);
      await db.update(validators).set({ secpAddr: addr }).where(eq(validators.id, row.id));
      ok++;
    } catch (err) {
      console.warn(`[populate-secp-addr] failed for ${row.id}: ${String(err)}`);
      failed++;
    }
  }

  console.log(`[populate-secp-addr] done: ${ok} updated, ${failed} failed`);

  // Verify
  const total = await db.execute(sql`SELECT COUNT(*) as c FROM validators`);
  const withAddr = await db.execute(
    sql`SELECT COUNT(*) as c FROM validators WHERE secp_addr IS NOT NULL`
  );
  console.log(
    `[populate-secp-addr] validators total: ${(total as unknown as { rows: Array<{ c: unknown }> }).rows[0]?.c}, with secp_addr: ${(withAddr as unknown as { rows: Array<{ c: unknown }> }).rows[0]?.c}`
  );
}

main().catch((err) => {
  console.error("[populate-secp-addr] fatal:", err);
  process.exit(1);
});
