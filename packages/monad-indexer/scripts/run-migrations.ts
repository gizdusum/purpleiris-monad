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

  // 0006 — secp_addr column on validators + validator_execution_revenue table
  await db`ALTER TABLE "validators" ADD COLUMN IF NOT EXISTS "secp_addr" text`;
  await db`CREATE INDEX IF NOT EXISTS idx_validators_secp_addr ON "validators" ("secp_addr")`;
  console.log("[migrate] 0006 secp_addr column + index: OK");

  await db`CREATE TABLE IF NOT EXISTS "validator_execution_revenue" (
    "id" bigserial PRIMARY KEY,
    "validator_id" text NOT NULL REFERENCES "validators"("id") ON DELETE CASCADE,
    "block_number" bigint NOT NULL,
    "block_timestamp" timestamptz NOT NULL,
    "fee_revenue_wei" numeric(78,0) NOT NULL,
    "tx_count" integer NOT NULL,
    "indexed_at" timestamptz DEFAULT now()
  )`;
  await db`CREATE UNIQUE INDEX IF NOT EXISTS idx_ver_validator_block
    ON "validator_execution_revenue" ("validator_id", "block_number")`;
  await db`CREATE INDEX IF NOT EXISTS idx_ver_validator_ts
    ON "validator_execution_revenue" ("validator_id", "block_timestamp" DESC)`;
  await db`CREATE INDEX IF NOT EXISTS idx_ver_block_number
    ON "validator_execution_revenue" ("block_number")`;
  console.log("[migrate] 0006 validator_execution_revenue table + indexes: OK");

  // 0007 — unclaimed_rewards_wei on validators + validator_staking_rewards table
  await db`ALTER TABLE "validators" ADD COLUMN IF NOT EXISTS "unclaimed_rewards_wei" numeric(78,0)`;
  console.log("[migrate] 0007 unclaimed_rewards_wei column: OK");

  // 0007 table + indexes: only create the old per-block schema if the daily-aggregate
  // schema (from 0008) doesn't already exist. 0008's DROP IF EXISTS + CREATE supersedes this.
  const hasOldCol = await db`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'validator_staking_rewards' AND column_name = 'onchain_validator_id'`;
  if (hasOldCol.length === 0) {
    // Table either doesn't exist yet or was already upgraded by 0008 — skip old indexes.
    console.log("[migrate] 0007 validator_staking_rewards: skipped (superseded by 0008)");
  } else {
    await db`CREATE UNIQUE INDEX IF NOT EXISTS idx_vsr_validator_block
      ON "validator_staking_rewards" ("onchain_validator_id", "block_number")`;
    await db`CREATE INDEX IF NOT EXISTS idx_vsr_auth_ts
      ON "validator_staking_rewards" ("validator_auth_address", "block_timestamp" DESC)`;
    await db`CREATE INDEX IF NOT EXISTS idx_vsr_block_number
      ON "validator_staking_rewards" ("block_number")`;
    console.log("[migrate] 0007 validator_staking_rewards table + indexes: OK");
  }

  // 0008 — redesign validator_staking_rewards as daily aggregate (Neon free-tier storage fix)
  // Drops the per-block table (~462 MB, 1 row/block) and replaces it with a daily aggregate
  // (~1 MB, 1 row per validator per calendar day). Idempotent via DROP IF EXISTS + CREATE.
  await db`DROP TABLE IF EXISTS "validator_staking_rewards"`;
  await db`CREATE TABLE "validator_staking_rewards" (
    "validator_id" bigint NOT NULL,
    "validator_auth_address" text NOT NULL REFERENCES "validators"("id") ON DELETE CASCADE,
    "day" date NOT NULL,
    "gross_reward_wei" numeric(78,0) NOT NULL DEFAULT 0,
    "commission_earned_wei" numeric(78,0) NOT NULL DEFAULT 0,
    "blocks_proposed" integer NOT NULL DEFAULT 0,
    "epoch_min" bigint,
    "epoch_max" bigint,
    "last_block_number" bigint NOT NULL,
    "updated_at" timestamptz DEFAULT NOW(),
    PRIMARY KEY ("validator_id", "day")
  )`;
  await db`CREATE INDEX IF NOT EXISTS idx_vsr_auth_day
    ON "validator_staking_rewards" ("validator_auth_address", "day" DESC)`;
  console.log("[migrate] 0008 validator_staking_rewards daily aggregate: OK");
}

main().catch((err) => {
  console.error("[migrate] fatal:", err);
  process.exit(1);
});
