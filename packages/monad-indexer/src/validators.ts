import type { OnChainValidator, NetworkStats } from "@purpleiris/shared-types";
import { getPublicClient } from "./client";
import { STAKING_PRECOMPILE } from "./config";
import { STAKING_ABI } from "./staking-abi";

// Validator-info community registry
// https://github.com/monad-developers/validator-info
const VALIDATOR_INFO_URL =
  "https://raw.githubusercontent.com/monad-developers/validator-info/main/validators.json";

type ValidatorMeta = {
  address: string;
  name?: string;
  logo?: string;
  website?: string;
  twitter?: string;
  region?: string;
  infraProvider?: string;
};

let _metaCache: ValidatorMeta[] | null = null;
let _metaCacheAt = 0;
const META_TTL_MS = 60 * 60 * 1000;

export async function getValidatorMeta(): Promise<ValidatorMeta[]> {
  if (_metaCache && Date.now() - _metaCacheAt < META_TTL_MS) {
    return _metaCache;
  }
  try {
    const res = await fetch(VALIDATOR_INFO_URL, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return _metaCache ?? [];
    const data = (await res.json()) as ValidatorMeta[];
    _metaCache = data;
    _metaCacheAt = Date.now();
    return data;
  } catch {
    return _metaCache ?? [];
  }
}

export async function getValidatorsFromChain(): Promise<OnChainValidator[]> {
  const client = getPublicClient();

  // Step 1: paginate getExecutionValidatorSet to collect all validator IDs.
  const validatorIds: bigint[] = [];
  let startIndex = 0;
  let pagesFetched = 0;
  const MAX_PAGES = 50; // safety cap: 50 * 100 = 5000 validators

  while (pagesFetched < MAX_PAGES) {
    const result = (await client.readContract({
      address: STAKING_PRECOMPILE,
      abi: STAKING_ABI,
      functionName: "getExecutionValidatorSet",
      args: [startIndex],
    })) as readonly [boolean, number, readonly bigint[]];

    const [isDone, nextIndex, valIds] = result;
    validatorIds.push(...valIds);
    pagesFetched++;

    if (isDone) break;
    startIndex = nextIndex;
  }

  if (pagesFetched >= MAX_PAGES) {
    console.warn(`[validators] hit MAX_PAGES safety cap at ${validatorIds.length} validators`);
  }

  console.log(`[validators] fetched ${validatorIds.length} validator IDs from execution set`);

  // Step 2: prefetch the community registry once and build an address lookup map.
  const metaList = await getValidatorMeta();
  const metaByAddress = new Map<string, ValidatorMeta>();
  for (const m of metaList) {
    metaByAddress.set(m.address.toLowerCase(), m);
  }

  // Step 3: fetch detail for each validator ID with bounded concurrency.
  const CONCURRENCY = 10;
  const results: OnChainValidator[] = [];

  for (let i = 0; i < validatorIds.length; i += CONCURRENCY) {
    const batch = validatorIds.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (valId) => {
        try {
          const detail = (await client.readContract({
            address: STAKING_PRECOMPILE,
            abi: STAKING_ABI,
            functionName: "getValidator",
            args: [valId],
          })) as readonly [
            `0x${string}`,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
            `0x${string}`,
            `0x${string}`,
          ];

          const [authAddress, , , , commission, , consensusStake] = detail;
          const addr = authAddress.toLowerCase();

          // commission is 1e18-scaled (10% = 1e17). Convert to BPS (1% = 100 BPS).
          // 1 BPS = 0.01% = 1e14 in the 1e18 scale.
          const commissionBps = Number(commission / 10n ** 14n);

          // Community registry lookup (Class 3 enrichment for display fields).
          const meta = metaByAddress.get(addr);

          const validator: OnChainValidator = {
            address: addr,
            moniker: meta?.name ?? `Validator ${valId}`,
            website: meta?.website ?? "",
            commissionBps,
            jailed: false, // TODO post-launch: derive from flags bit pattern
            active: true, // present in execution set => active
            stakedAmount: consensusStake, // current-epoch active stake
            validatorId: valId,
          };

          return validator;
        } catch (err) {
          console.warn(`[validators] failed to fetch validator ${valId}:`, err);
          return null;
        }
      })
    );

    for (const r of batchResults) {
      if (r !== null) results.push(r);
    }
  }

  console.log(`[validators] enriched ${results.length} validators`);
  return results;
}

export async function getNetworkStats(): Promise<NetworkStats> {
  const validators = await getValidatorsFromChain();
  const active = validators.filter((v) => v.active && !v.jailed);

  const meta = await getValidatorMeta();
  const providers = new Map<string, number>();
  for (const v of active) {
    const m = meta.find((m) => m.address.toLowerCase() === v.address.toLowerCase());
    const provider = m?.infraProvider ?? "unknown";
    providers.set(provider, (providers.get(provider) ?? 0) + 1);
  }

  const nakamoto = computeNakamoto(providers, active.length);
  const diversityScore = Math.min(10, nakamoto * 1.2);

  return {
    totalValidators: validators.length,
    activeValidators: active.length,
    successRate: 0, // TODO Phase 2: derive from block production data
    diversityScore: Math.round(diversityScore * 10) / 10,
  };
}

function computeNakamoto(providers: Map<string, number>, total: number): number {
  const sorted = [...providers.values()].sort((a, b) => b - a);
  let cumulative = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i]!;
    if (cumulative > total / 3) return i + 1;
  }
  return sorted.length;
}
