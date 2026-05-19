import { desc } from "drizzle-orm";
import { getDb, monadReleases } from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { ToolResult } from "./types";

export async function getLatestMonadReleaseTool(): Promise<ToolResult> {
  const db = getDb();

  const rows = await db
    .select()
    .from(monadReleases)
    .orderBy(desc(monadReleases.publishedAt))
    .limit(6);

  if (rows.length === 0) {
    return makeResult(
      { error: "No Monad releases found in database. Sync may not have run yet." },
      { data_class: 1, source: "get_latest_monad_release" }
    );
  }

  const now = Date.now();
  const daysAgo = (d: Date) => Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24));

  const [latest, ...previous] = rows;

  return makeResult(
    {
      fetched_at: latest!.fetchedAt.toISOString(),
      latest_release: {
        tag: latest!.tagName,
        published_at: latest!.publishedAt.toISOString(),
        published_days_ago: daysAgo(latest!.publishedAt),
        html_url: latest!.htmlUrl,
        is_prerelease: latest!.isPrerelease,
        summary: latest!.body ? latest!.body.slice(0, 300) : null,
      },
      previous_releases: previous.map((r) => ({
        tag: r.tagName,
        published_at: r.publishedAt.toISOString(),
        published_days_ago: daysAgo(r.publishedAt),
        is_prerelease: r.isPrerelease,
      })),
    },
    { data_class: 1, source: "get_latest_monad_release" }
  );
}
