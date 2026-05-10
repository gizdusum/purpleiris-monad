import { getPublicClient } from "./client";
import { STAKING_PRECOMPILE } from "./config";
import { STAKING_ABI } from "./staking-abi";
import { getMockNetworkSnapshot } from "./mock-data";

export type OnChainValidator = {
  address: string;
  moniker: string;
  website: string;
  commissionBps: number;
  jailed: boolean;
  active: boolean;
  stakedAmount: bigint;
};

export type NetworkStats = {
  totalValidators: number;
  activeValidators: number;
  successRate: number;
  diversityScore: number;
};

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
const META_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getValidatorMeta(): Promise<ValidatorMeta[]> {
  if (_metaCache && Date.now() - _metaCacheAt < META_TTL_MS) {
    return _metaCache;
  }
  try {
    const res = await fetch(VALIDATOR_INFO_URL, { next: { revalidate: 3600 } });
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
  try {
    const result = await client.readContract({
      address: STAKING_PRECOMPILE,
      abi: STAKING_ABI,
      functionName: "getValidators",
    });

    const validators = result as {
      valAddress: `0x${string}`;
      moniker: string;
      website: string;
      commission: bigint;
      jailed: boolean;
      active: boolean;
    }[];

    // Fetch staked amounts in parallel (capped to avoid rate limiting)
    const withStake = await Promise.all(
      validators.slice(0, 200).map(async (v) => {
        try {
          const staked = await client.readContract({
            address: STAKING_PRECOMPILE,
            abi: STAKING_ABI,
            functionName: "getStakedAmount",
            args: [v.valAddress],
          });
          return {
            address: v.valAddress,
            moniker: v.moniker,
            website: v.website,
            commissionBps: Number(v.commission),
            jailed: v.jailed,
            active: v.active,
            stakedAmount: staked as bigint,
          };
        } catch {
          return {
            address: v.valAddress,
            moniker: v.moniker,
            website: v.website,
            commissionBps: Number(v.commission),
            jailed: v.jailed,
            active: v.active,
            stakedAmount: 0n,
          };
        }
      })
    );

    return withStake;
  } catch (err) {
    console.error("[validators] chain read failed, returning mock:", err);
    // Graceful fallback to mock while RPC is unavailable
    return getMockValidators();
  }
}

export async function getNetworkStats(): Promise<NetworkStats> {
  try {
    const validators = await getValidatorsFromChain();
    const active = validators.filter((v) => v.active && !v.jailed);

    // Diversity score: 0-10 based on Nakamoto coefficient approximation
    // Count unique infra providers from community registry
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
      successRate: 99.1, // TODO: derive from block production data
      diversityScore: Math.round(diversityScore * 10) / 10,
    };
  } catch {
    const mock = getMockNetworkSnapshot();
    return {
      totalValidators: mock.activeValidators + 12,
      activeValidators: mock.activeValidators,
      successRate: mock.successRate,
      diversityScore: mock.diversityScore,
    };
  }
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

function getMockValidators(): OnChainValidator[] {
  return Array.from({ length: 212 }, (_, i) => ({
    address: `0x${String(i + 1).padStart(40, "0")}`,
    moniker: `Validator ${i + 1}`,
    website: "",
    commissionBps: 300 + (i % 20) * 100,
    jailed: i >= 205,
    active: i < 200,
    stakedAmount: BigInt(5_000_000 - i * 20_000) * 10n ** 18n,
  }));
}
