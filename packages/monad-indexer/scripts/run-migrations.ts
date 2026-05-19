import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const db = neon(url);

  // 0002 — validator_metadata table
  await db`CREATE TABLE IF NOT EXISTS "validator_metadata" (
    "pubkey" text PRIMARY KEY NOT NULL,
    "moniker" text,
    "logo_url" text,
    "website" text,
    "description" text,
    "last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
  )`;
  console.log("[migrate] 0002 validator_metadata: OK");

  // 0003 — secp_pubkey column on validators
  await db`ALTER TABLE "validators" ADD COLUMN IF NOT EXISTS "secp_pubkey" text`;
  console.log("[migrate] 0003 secp_pubkey: OK");

  // Verify
  const r1 =
    await db`SELECT column_name FROM information_schema.columns WHERE table_name = 'validators' AND column_name = 'secp_pubkey'`;
  const r2 =
    await db`SELECT table_name FROM information_schema.tables WHERE table_name = 'validator_metadata'`;

  console.log("[verify] secp_pubkey column:", r1[0]?.column_name ?? "MISSING");
  console.log("[verify] validator_metadata table:", r2[0]?.table_name ?? "MISSING");

  // 0004 — epoch_snapshots composite index for validator time-range scans
  await db`CREATE INDEX IF NOT EXISTS idx_epoch_snapshots_validator_snapshot_at
    ON epoch_snapshots(validator_id, snapshot_at DESC)`;
  console.log("[migrate] 0004 idx_epoch_snapshots_validator_snapshot_at: OK");

  // 0005 — monad_releases table + index
  await db`CREATE TABLE IF NOT EXISTS monad_releases (
    id SERIAL PRIMARY KEY,
    tag_name TEXT NOT NULL UNIQUE,
    published_at TIMESTAMPTZ NOT NULL,
    html_url TEXT NOT NULL,
    body TEXT,
    is_prerelease BOOLEAN NOT NULL DEFAULT FALSE,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db`CREATE INDEX IF NOT EXISTS idx_monad_releases_published
    ON monad_releases (published_at DESC)`;
  console.log("[migrate] 0005 monad_releases: OK");
}

main().catch((err) => {
  console.error("[migrate] fatal:", err);
  process.exit(1);
});
