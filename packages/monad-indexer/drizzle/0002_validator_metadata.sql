CREATE TABLE IF NOT EXISTS "validator_metadata" (
  "pubkey" text PRIMARY KEY NOT NULL,
  "moniker" text,
  "logo_url" text,
  "website" text,
  "description" text,
  "last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
