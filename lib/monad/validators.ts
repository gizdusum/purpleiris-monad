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
  flag?: string;
  country?: string;
  provider?: string;
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

const NAMED_VALIDATORS: [string, string, string, string][] = [
  ["Chorus One", "🇨🇭", "Switzerland", "Equinix"],
  ["Figment", "🇨🇦", "Canada", "AWS"],
  ["P2P.org", "🇩🇪", "Germany", "Hetzner"],
  ["Everstake", "🇺🇦", "Ukraine", "OVH"],
  ["InfStones", "🇺🇸", "United States", "AWS"],
  ["Cosmostation", "🇰🇷", "South Korea", "AWS"],
  ["Blockscape", "🇩🇪", "Germany", "Hetzner"],
  ["Stakin", "🇫🇷", "France", "OVH"],
  ["HashKey Cloud", "🇭🇰", "Hong Kong", "Alibaba Cloud"],
  ["Stakefish", "🇰🇷", "South Korea", "Google Cloud"],
  ["B-Harvest", "🇰🇷", "South Korea", "Kakao Cloud"],
  ["Forbole", "🇭🇰", "Hong Kong", "AWS"],
  ["Lavender Five", "🇺🇸", "United States", "Hetzner"],
  ["NodeStake", "🇸🇬", "Singapore", "Google Cloud"],
  ["Bware Labs", "🇷🇴", "Romania", "OVH"],
  ["01node", "🇷🇴", "Romania", "Hetzner"],
  ["Stakely", "🇪🇸", "Spain", "Hetzner"],
  ["Allnodes", "🇺🇸", "United States", "Google Cloud"],
  ["Noderunners", "🇳🇱", "Netherlands", "Hetzner"],
  ["Imperator.co", "🇫🇷", "France", "OVH"],
  ["StakeWithUs", "🇸🇬", "Singapore", "AWS"],
  ["Ubik Capital", "🇺🇸", "United States", "AWS"],
  ["Blockdaemon", "🇬🇧", "United Kingdom", "AWS"],
  ["Kiln", "🇫🇷", "France", "OVH"],
  ["Luganodes", "🇨🇭", "Switzerland", "Equinix"],
  ["Pier Two", "🇦🇺", "Australia", "AWS"],
  ["DragonStake", "🇸🇰", "Slovakia", "Hetzner"],
  ["Galaxy Digital", "🇺🇸", "United States", "Equinix"],
  ["Coinbase Cloud", "🇺🇸", "United States", "AWS"],
  ["Jump Crypto", "🇺🇸", "United States", "Equinix"],
  ["Polychain Labs", "🇺🇸", "United States", "AWS"],
  ["Binance Node", "🇲🇹", "Malta", "AWS"],
  ["OKX Validator", "🇲🇹", "Malta", "AWS"],
  ["Kraken Node", "🇺🇸", "United States", "AWS"],
  ["DWF Labs", "🇦🇪", "UAE", "AWS"],
  ["HashQuark", "🇨🇳", "China", "Alibaba Cloud"],
  ["Ryabina", "🇬🇧", "United Kingdom", "Hetzner"],
  ["DSRV", "🇰🇷", "South Korea", "Naver Cloud"],
  ["Chainflow", "🇺🇸", "United States", "Hetzner"],
  ["SG-1", "🇩🇪", "Germany", "Hetzner"],
  ["Notional", "🇺🇸", "United States", "Hetzner"],
  ["IceCreamNode", "🇫🇮", "Finland", "Hetzner"],
  ["Moonlet", "🇷🇴", "Romania", "OVH"],
  ["AUDIT.one", "🇫🇷", "France", "OVH"],
  ["Stargaze", "🇺🇸", "United States", "AWS"],
  ["Anonstake", "🇩🇪", "Germany", "Hetzner"],
  ["Covalent Node", "🇺🇸", "United States", "GCP"],
  ["Mechanism Cap.", "🇺🇸", "United States", "AWS"],
  ["Monad Labs", "🇺🇸", "United States", "AWS"],
  ["Nakamoto Pool", "🇯🇵", "Japan", "AWS"],
];

const COUNTRY_POOL: [string, string, string][] = [
  ["🇺🇸", "United States", "AWS"],
  ["🇩🇪", "Germany", "Hetzner"],
  ["🇸🇬", "Singapore", "Google Cloud"],
  ["🇰🇷", "South Korea", "AWS"],
  ["🇬🇧", "United Kingdom", "OVH"],
  ["🇫🇷", "France", "OVH"],
  ["🇯🇵", "Japan", "AWS"],
  ["🇦🇺", "Australia", "AWS"],
  ["🇳🇱", "Netherlands", "Hetzner"],
  ["🇧🇷", "Brazil", "AWS"],
  ["🇨🇦", "Canada", "AWS"],
  ["🇺🇦", "Ukraine", "OVH"],
  ["🇷🇴", "Romania", "Hetzner"],
  ["🇮🇳", "India", "AWS"],
  ["🇦🇪", "UAE", "AWS"],
  ["🇨🇭", "Switzerland", "Equinix"],
  ["🇦🇹", "Austria", "Hetzner"],
  ["🇵🇱", "Poland", "OVH"],
  ["🇸🇪", "Sweden", "AWS"],
  ["🇮🇹", "Italy", "OVH"],
];

function getMockValidators(): OnChainValidator[] {
  return Array.from({ length: 212 }, (_, i) => {
    const named = NAMED_VALIDATORS[i];
    const pool = COUNTRY_POOL[(i - NAMED_VALIDATORS.length) % COUNTRY_POOL.length]!;
    const flag = named ? named[1] : pool[0];
    const country = named ? named[2] : pool[1];
    const provider = named ? named[3] : pool[2];
    const moniker = named ? named[0] : `Node-${String(i + 1).padStart(3, "0")}`;
    return {
      address: `0x${String(i + 1).padStart(40, "0")}`,
      moniker,
      website: "",
      commissionBps: 300 + (i % 20) * 100,
      jailed: i >= 205,
      active: i < 200,
      stakedAmount: BigInt(5_000_000 - i * 20_000) * 10n ** 18n,
      flag,
      country,
      provider,
    };
  });
}
