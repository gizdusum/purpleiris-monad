import { eq, sql } from "drizzle-orm";
import { getDb, validators, validatorMetadata } from "@purpleiris/monad-indexer";

export type CandidateMatch = {
  moniker: string;
  slug: string;
  address: string;
  distance: number;
};

export type ResolveResult =
  | { kind: "found"; id: string; moniker: string; slug: string; resolutionNote: string | null }
  | { kind: "candidates"; candidates: CandidateMatch[] }
  | { kind: "not_found" };

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function levenshtein(a: string, b: string): number {
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? (prev[j - 1] ?? 0)
          : 1 + Math.min(prev[j] ?? 0, curr[j - 1] ?? 0, prev[j - 1] ?? 0);
    }
    prev = curr;
  }
  return prev[n] ?? 0;
}

const joinCond = sql`${validators.secpPubkey} IS NOT NULL AND ${validators.secpPubkey} = ${validatorMetadata.pubkey}`;

/**
 * Resolve a validator name (slug or moniker) to its DB row.
 * Does NOT handle address (0x…) lookups — callers do that directly.
 *
 * Resolution order: exact case-insensitive → Levenshtein fuzzy.
 */
export async function resolveValidatorByName(id: string): Promise<ResolveResult> {
  const db = getDb();
  const idLower = id.toLowerCase();

  // 1. Case-insensitive slug / moniker / meta_moniker
  const rows = await db
    .select({
      id: validators.id,
      moniker: validators.moniker,
      meta_moniker: validatorMetadata.moniker,
      slug: validators.slug,
    })
    .from(validators)
    .leftJoin(validatorMetadata, joinCond)
    .where(
      sql`LOWER(${validators.slug}) = ${idLower}
        OR LOWER(${validators.moniker}) = ${idLower}
        OR LOWER(${validatorMetadata.moniker}) = ${idLower}`
    )
    .limit(1);

  if (rows[0]) {
    const row = rows[0];
    const resolvedLabel = row.meta_moniker ?? row.moniker ?? row.slug ?? "";
    const resolutionNote =
      resolvedLabel.toLowerCase() !== idLower ? `Resolved '${id}' → '${resolvedLabel}'` : null;
    return {
      kind: "found",
      id: row.id,
      moniker: resolvedLabel,
      slug: row.slug ?? "",
      resolutionNote,
    };
  }

  // 2. Fuzzy fallback — fetch all active validators and compute Levenshtein distance
  const allRows = await db
    .select({
      id: validators.id,
      moniker: validators.moniker,
      slug: validators.slug,
      meta_moniker: validatorMetadata.moniker,
    })
    .from(validators)
    .leftJoin(validatorMetadata, joinCond)
    .where(eq(validators.active, true));

  const normInput = normalize(id);
  const candidates = allRows
    .map((v) => {
      const label = v.meta_moniker ?? v.moniker ?? v.slug ?? "";
      const normLabel = normalize(label);
      const normSlug = normalize(v.slug ?? "");
      const dist = Math.min(levenshtein(normInput, normLabel), levenshtein(normInput, normSlug));
      const isSubstring =
        normLabel.includes(normInput) ||
        normInput.includes(normLabel) ||
        normSlug.includes(normInput) ||
        normInput.includes(normSlug);
      return { id: v.id, moniker: label, slug: v.slug ?? "", dist, isSubstring };
    })
    .filter((c) => c.dist <= 3 || c.isSubstring)
    .sort((a, b) => a.dist - b.dist || a.moniker.localeCompare(b.moniker))
    .slice(0, 5);

  if (candidates.length === 0) {
    return { kind: "not_found" };
  }

  const top = candidates[0]!;
  if (candidates.length === 1 && top.dist <= 1) {
    // Single very close match — auto-resolve
    return {
      kind: "found",
      id: top.id,
      moniker: top.moniker,
      slug: top.slug,
      resolutionNote: `Resolved '${id}' → '${top.moniker}'`,
    };
  }

  return {
    kind: "candidates",
    candidates: candidates.map((c) => ({
      moniker: c.moniker,
      slug: c.slug,
      address: c.id,
      distance: c.dist,
    })),
  };
}
