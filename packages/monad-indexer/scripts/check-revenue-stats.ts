import "dotenv/config";
import { getDb } from "../src/db/client";
import { sql } from "drizzle-orm";

async function main() {
  const db = getDb();
  const r = await db.execute(
    sql`SELECT COUNT(*) as c, MIN(block_number) as mn, MAX(block_number) as mx FROM validator_execution_revenue`
  );
  const v = await db.execute(
    sql`SELECT COUNT(DISTINCT validator_id) as validators FROM validator_execution_revenue`
  );
  const rows = (r as { rows: unknown[] }).rows[0];
  const vals = (v as { rows: unknown[] }).rows[0];
  console.log("rows:", rows, "validators:", vals);
}
main().catch(console.error);
