import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL is not set");
    // Same reason as the RPC client: queries must not be replayed from a fetch cache.
    const sql = neon(url, { fetchOptions: { cache: "no-store" } });
    _db = drizzle(sql, { schema });
  }
  return _db;
}

export type Db = ReturnType<typeof getDb>;
