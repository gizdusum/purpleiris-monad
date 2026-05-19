/**
 * sync-monad-releases.ts
 * Fetches Monad protocol releases from GitHub and upserts into monad_releases.
 *
 * Run from repo root:
 *   DATABASE_URL=<neon-url> pnpm --filter @purpleiris/monad-indexer tsx scripts/sync-monad-releases.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { monadReleases } from "../src/db/schema";

const PRIMARY_URL = "https://api.github.com/repos/monad-developers/monad-bft/releases";
const FALLBACK_URL = "https://api.github.com/repos/monad-developers/monad/releases";
const USER_AGENT = "PurpleIris-release-watcher/1.0";

type GitHubRelease = {
  tag_name: string;
  published_at: string;
  html_url: string;
  body: string | null;
  prerelease: boolean;
};

/** Returns releases array, empty array for 404/empty, or null for rate-limit (exit signal). */
async function fetchReleases(url: string): Promise<GitHubRelease[] | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/vnd.github.v3+json" },
  });

  if (res.status === 403 || res.status === 429) {
    console.log(`[sync-releases] rate-limited (${res.status}) — exiting 0`);
    return null; // signal: exit cleanly
  }

  if (res.status === 404) {
    console.log(`[sync-releases] repo not found (404) at ${url}, trying fallback`);
    return []; // signal: try fallback
  }

  if (!res.ok) {
    console.log(`[sync-releases] HTTP ${res.status} for ${url}`);
    return []; // treat other errors as empty, try fallback
  }

  return (await res.json()) as GitHubRelease[];
}

async function main() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("[sync-releases] DATABASE_URL is not set");
    process.exit(1);
  }

  const neonSql = neon(url);
  const db = drizzle(neonSql, { schema: { monadReleases } });

  console.log("[sync-releases] fetching Monad releases from GitHub...");

  let releases = await fetchReleases(PRIMARY_URL);
  if (releases === null) process.exit(0); // rate-limited
  if (releases.length === 0) {
    console.log(`[sync-releases] primary repo empty or missing, trying fallback...`);
    releases = await fetchReleases(FALLBACK_URL);
    if (releases === null) process.exit(0); // rate-limited on fallback
  }

  if (releases.length === 0) {
    console.warn("[sync-releases] no releases found in either repo");
    return;
  }

  console.log(`[sync-releases] upserting ${releases.length} releases...`);

  for (const r of releases) {
    if (!r.tag_name || !r.published_at) continue;
    await db
      .insert(monadReleases)
      .values({
        tagName: r.tag_name,
        publishedAt: new Date(r.published_at),
        htmlUrl: r.html_url,
        body: r.body ?? null,
        isPrerelease: r.prerelease,
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: monadReleases.tagName,
        set: {
          publishedAt: sql`EXCLUDED.published_at`,
          htmlUrl: sql`EXCLUDED.html_url`,
          body: sql`EXCLUDED.body`,
          isPrerelease: sql`EXCLUDED.is_prerelease`,
          fetchedAt: sql`now()`,
        },
      });
  }

  console.log(`[sync-releases] ✓ upserted ${releases.length} release rows`);
}

main().catch((err) => {
  console.error("[sync-releases] fatal:", err);
  process.exit(1);
});
