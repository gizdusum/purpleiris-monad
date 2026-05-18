/**
 * sync-validator-info.ts
 * Fetches validator metadata from the monad-developers/validator-info registry
 * and upserts into the validator_metadata table.
 *
 * Run from repo root:
 *   DATABASE_URL=<neon-url> pnpm --filter @purpleiris/monad-indexer tsx scripts/sync-validator-info.ts
 * Or from packages/monad-indexer with a .env file:
 *   pnpm tsx scripts/sync-validator-info.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { validatorMetadata } from "../src/db/schema";

const CONTENTS_URL =
  "https://api.github.com/repos/monad-developers/validator-info/contents/mainnet";
const FALLBACK_URL =
  "https://raw.githubusercontent.com/monad-developers/validator-info/main/validators.json";

type MetaRow = {
  pubkey: string;
  moniker: string;
  logoUrl: string;
  website: string;
  description: string;
};

async function fetchViaContentsApi(): Promise<MetaRow[] | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "purpleiris-sync/1.0",
  };
  if (process.env["GITHUB_TOKEN"]) {
    headers["Authorization"] = `Bearer ${process.env["GITHUB_TOKEN"]}`;
  }

  const dirRes = await fetch(CONTENTS_URL, { headers });
  if (!dirRes.ok) {
    console.log(`[sync] mainnet/ directory not found (${dirRes.status}), trying fallback`);
    return null;
  }

  const files = (await dirRes.json()) as Array<{ name: string; download_url: string | null }>;
  const jsonFiles = files.filter((f) => f.name.endsWith(".json"));
  console.log(`[sync] found ${jsonFiles.length} JSON files in mainnet/`);

  const rows: MetaRow[] = [];
  const results = await Promise.allSettled(
    jsonFiles.map(async (file) => {
      const pubkey = file.name.replace(/\.json$/, "").toLowerCase();
      const url =
        file.download_url ??
        `https://raw.githubusercontent.com/monad-developers/validator-info/main/mainnet/${file.name}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${file.name}`);

      const data = (await res.json()) as {
        moniker?: string;
        name?: string;
        logo_url?: string;
        logo?: string;
        website?: string;
        description?: string;
      };

      return {
        pubkey,
        moniker: data.moniker ?? data.name ?? "",
        logoUrl: data.logo_url ?? data.logo ?? "",
        website: data.website ?? "",
        description: data.description ?? "",
      };
    })
  );

  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      rows.push(r.value);
    } else {
      failed++;
      console.warn(`[sync] skipped one file:`, r.reason);
    }
  }

  console.log(`[sync] parsed ${rows.length} entries, ${failed} skipped`);
  return rows;
}

async function fetchViaFallback(): Promise<MetaRow[]> {
  console.log(`[sync] fetching fallback validators.json`);
  const res = await fetch(FALLBACK_URL, {
    headers: { "User-Agent": "purpleiris-sync/1.0" },
  });
  if (!res.ok) throw new Error(`Fallback fetch failed: HTTP ${res.status}`);

  const data = (await res.json()) as Array<{
    address?: string;
    name?: string;
    logo?: string;
    logo_url?: string;
    website?: string;
    description?: string;
  }>;

  return data
    .filter((v) => v.address)
    .map((v) => ({
      pubkey: v.address!.toLowerCase(),
      moniker: v.name ?? "",
      logoUrl: v.logo_url ?? v.logo ?? "",
      website: v.website ?? "",
      description: v.description ?? "",
    }));
}

async function main() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("[sync] DATABASE_URL is not set");
    process.exit(1);
  }

  const neonSql = neon(url);
  const db = drizzle(neonSql, { schema: { validatorMetadata } });

  console.log("[sync] fetching validator info from registry...");

  let rows: MetaRow[];
  try {
    rows = (await fetchViaContentsApi()) ?? (await fetchViaFallback());
  } catch (err) {
    console.error("[sync] failed to fetch validator info:", err);
    process.exit(1);
  }

  if (rows.length === 0) {
    console.warn("[sync] no rows to upsert — registry may be empty");
    return;
  }

  console.log(`[sync] upserting ${rows.length} rows...`);

  let upserted = 0;
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await db
      .insert(validatorMetadata)
      .values(
        batch.map((r) => ({
          pubkey: r.pubkey,
          moniker: r.moniker || null,
          logoUrl: r.logoUrl || null,
          website: r.website || null,
          description: r.description || null,
        }))
      )
      .onConflictDoUpdate({
        target: validatorMetadata.pubkey,
        set: {
          moniker: sql`EXCLUDED.moniker`,
          logoUrl: sql`EXCLUDED.logo_url`,
          website: sql`EXCLUDED.website`,
          description: sql`EXCLUDED.description`,
          lastSyncedAt: sql`now()`,
        },
      });
    upserted += batch.length;
  }

  console.log(`[sync] ✓ upserted ${upserted} validator metadata rows`);
}

main().catch((err) => {
  console.error("[sync] fatal:", err);
  process.exit(1);
});
