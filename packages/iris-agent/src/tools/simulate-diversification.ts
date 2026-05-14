import { inArray } from "drizzle-orm";
import { getDb, validators } from "@purpleiris/monad-indexer";
import { makeResult } from "./types";
import type { SimulateDiversificationInput, ToolResult } from "./types";

function shannonEntropy(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return -weights
    .map((w) => w / total)
    .filter((p) => p > 0)
    .reduce((h, p) => h + p * Math.log2(p), 0);
}

export async function simulateDiversificationTool({
  allocations,
}: SimulateDiversificationInput): Promise<ToolResult> {
  if (allocations.length === 0) {
    return makeResult(
      { error: "No allocations provided." },
      { data_class: 2, source: "simulate_diversification" }
    );
  }

  const db = getDb();
  const ids = allocations.map((a) =>
    a.validator_id.toLowerCase().startsWith("0x") ? a.validator_id.toLowerCase() : a.validator_id
  );

  // Look up validators to get region/infra info for diversity analysis
  const rows = await db
    .select({
      id: validators.id,
      slug: validators.slug,
      moniker: validators.moniker,
      region: validators.region,
      infraProvider: validators.infraProvider,
    })
    .from(validators)
    .where(inArray(validators.id, ids));

  const slugMap = new Map(rows.map((r) => [r.slug, r]));
  const idMap = new Map(rows.map((r) => [r.id, r]));

  const resolved = allocations.map((a) => {
    const v = idMap.get(a.validator_id.toLowerCase()) ?? slugMap.get(a.validator_id) ?? null;
    return {
      validator_id: a.validator_id,
      moniker: v?.moniker ?? "unknown",
      stake_mon: a.stake_mon,
      region: v?.region ?? "unknown",
      infra_provider: v?.infraProvider ?? "unknown",
    };
  });

  const stakes = resolved.map((a) => a.stake_mon);
  const totalStake = stakes.reduce((a, b) => a + b, 0);

  // Entropy metrics
  const validatorEntropy = shannonEntropy(stakes);
  const maxValidatorEntropy = Math.log2(allocations.length);
  const validatorDiversityScore =
    maxValidatorEntropy > 0 ? validatorEntropy / maxValidatorEntropy : 1;

  // Region diversity
  const regionMap = new Map<string, number>();
  for (const a of resolved) {
    regionMap.set(a.region, (regionMap.get(a.region) ?? 0) + a.stake_mon);
  }
  const regionEntropy = shannonEntropy([...regionMap.values()]);
  const maxRegionEntropy = Math.log2(regionMap.size);
  const regionDiversityScore = maxRegionEntropy > 0 ? regionEntropy / maxRegionEntropy : 1;

  // Infra diversity
  const infraMap = new Map<string, number>();
  for (const a of resolved) {
    infraMap.set(a.infra_provider, (infraMap.get(a.infra_provider) ?? 0) + a.stake_mon);
  }
  const infraEntropy = shannonEntropy([...infraMap.values()]);
  const maxInfraEntropy = Math.log2(infraMap.size);
  const infraDiversityScore = maxInfraEntropy > 0 ? infraEntropy / maxInfraEntropy : 1;

  // Composite score (0–10)
  const compositeScore =
    (validatorDiversityScore * 0.4 + regionDiversityScore * 0.35 + infraDiversityScore * 0.25) * 10;

  return makeResult(
    {
      total_stake_mon: totalStake,
      validator_count: allocations.length,
      allocations: resolved.map((a) => ({
        ...a,
        weight_pct: totalStake > 0 ? Math.round((a.stake_mon / totalStake) * 1000) / 10 : 0,
      })),
      scores: {
        validator_distribution: {
          shannon_entropy: Math.round(validatorEntropy * 1000) / 1000,
          normalized_0_to_1: Math.round(validatorDiversityScore * 1000) / 1000,
        },
        region_distribution: {
          regions: Object.fromEntries(regionMap),
          normalized_0_to_1: Math.round(regionDiversityScore * 1000) / 1000,
        },
        infra_distribution: {
          providers: Object.fromEntries(infraMap),
          normalized_0_to_1: Math.round(infraDiversityScore * 1000) / 1000,
        },
        composite_diversity_score_0_to_10: Math.round(compositeScore * 10) / 10,
      },
      formula: "Shannon entropy (H = -Σ p_i × log2(p_i)), formula v1.0 (/methodology)",
    },
    { data_class: 2, source: "simulate_diversification" }
  );
}
