"use client";

import { useState, useCallback } from "react";
import { createPublicClient, http, formatEther } from "viem";
import { Link } from "@/i18n/navigation";
import { toSlug } from "@/lib/monad/slug";

const MONAD_CHAIN = {
  id: 41454,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } },
} as const;

const STAKING_PRECOMPILE = "0x0000000000000000000000000000000000000800" as const;

// getStakedAmount(address delegator, address validator) → uint256
const GET_STAKED_ABI = [
  {
    name: "getStakedAmount",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "delegator", type: "address" },
      { name: "validator", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

type Delegation = {
  validatorAddress: string;
  validatorName: string;
  slug: string;
  amount: bigint;
  amountFormatted: string;
};

type DiversityResult = {
  score: number;
  totalStaked: string;
  delegations: Delegation[];
  suggestions: string[];
};

// Mock validator set for demo (real data comes from chain)
const MOCK_VALIDATORS = [
  { address: "0x1000000000000000000000000000000000000001", name: "Chorus One" },
  { address: "0x1000000000000000000000000000000000000002", name: "P2P.org" },
  { address: "0x1000000000000000000000000000000000000003", name: "Figment" },
  { address: "0x1000000000000000000000000000000000000004", name: "Everstake" },
  { address: "0x1000000000000000000000000000000000000005", name: "Cosmostation" },
];

function shannonEntropy(amounts: bigint[]): number {
  const total = amounts.reduce((a, b) => a + b, 0n);
  if (total === 0n) return 0;
  let entropy = 0;
  for (const a of amounts) {
    if (a === 0n) continue;
    const p = Number(a) / Number(total);
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function computeDiversityScore(delegations: Delegation[]): number {
  if (delegations.length === 0) return 0;
  const amounts = delegations.map((d) => d.amount);
  const entropy = shannonEntropy(amounts);
  const maxEntropy = Math.log2(delegations.length);
  const normalized = maxEntropy > 0 ? entropy / maxEntropy : 0;
  // Score 0-10: single validator = 0, perfectly equal = 10
  const base = normalized * 7 + Math.min(delegations.length, 5) * 0.6;
  return Math.round(Math.min(10, base) * 10) / 10;
}

export function PersonalStakeClient() {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiversityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStake = useCallback(async (addr: string) => {
    const client = createPublicClient({ chain: MONAD_CHAIN, transport: http() });

    const delegations: Delegation[] = [];

    // Query each known validator for delegated amount
    await Promise.all(
      MOCK_VALIDATORS.map(async (v) => {
        try {
          const amount = await client.readContract({
            address: STAKING_PRECOMPILE,
            abi: GET_STAKED_ABI,
            functionName: "getStakedAmount",
            args: [addr as `0x${string}`, v.address as `0x${string}`],
          });
          if ((amount as bigint) > 0n) {
            delegations.push({
              validatorAddress: v.address,
              validatorName: v.name,
              slug: toSlug(v.name),
              amount: amount as bigint,
              amountFormatted: parseFloat(formatEther(amount as bigint)).toFixed(2),
            });
          }
        } catch {
          // skip failed reads
        }
      })
    );

    const score = computeDiversityScore(delegations);
    const totalRaw = delegations.reduce((a, d) => a + d.amount, 0n);
    const totalFormatted = parseFloat(formatEther(totalRaw)).toFixed(2);

    const suggestions: string[] = [];
    if (delegations.length === 0) {
      suggestions.push("Start staking on Monad to build your diversity score.");
    } else if (delegations.length === 1) {
      suggestions.push("Spread your stake to 3+ validators to improve diversity.");
      suggestions.push(
        "Try validators from different regions (EU, AS, OC) for geographic diversity."
      );
    } else if (score < 5) {
      suggestions.push("Your stake is concentrated — consider rebalancing across more validators.");
      suggestions.push("Include a mid-tier validator (rank #21–#60) to support decentralization.");
    } else if (score < 8) {
      suggestions.push(
        "Good diversity! Adding one more small/mid-tier validator would push your score above 8."
      );
    } else {
      suggestions.push(
        "Excellent diversity! You are actively supporting Monad's decentralization."
      );
    }

    setResult({ score, totalStaked: totalFormatted, delegations, suggestions });
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    if (typeof window === "undefined" || !("ethereum" in window)) {
      setError("No wallet detected. Please install MetaMask or a compatible wallet.");
      return;
    }
    setLoading(true);
    try {
      const eth = (
        window as Window & {
          ethereum: { request: (a: { method: string; params?: unknown[] }) => Promise<string[]> };
        }
      ).ethereum;
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const addr = accounts[0];
      if (!addr) throw new Error("No account returned");
      setAddress(addr);
      await fetchStake(addr);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }, [fetchStake]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setResult(null);
    setError(null);
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wider uppercase">
          <span className="bg-primary size-1.5 animate-pulse rounded-full" />
          Personal Score
        </div>
        <h1 className="font-heading text-foreground text-4xl font-bold">My Stake Score</h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm">
          Connect your wallet to see your delegation diversity score and get personalized
          recommendations.
        </p>
      </div>

      {!address ? (
        <div className="border-border/40 bg-card space-y-6 rounded-3xl border p-8 text-center">
          {/* Score preview */}
          <div className="border-primary/20 bg-primary/5 mx-auto flex size-32 items-center justify-center rounded-full border">
            <div>
              <div className="font-heading text-primary/30 text-5xl font-black">?</div>
              <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                Score
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-foreground font-semibold">Connect your wallet to start</h2>
            <p className="text-muted-foreground text-sm">
              Read-only — we never request transaction permissions
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={connect}
            disabled={loading}
            className="bg-primary text-primary-foreground inline-flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Connecting…" : "Connect Wallet"}
          </button>

          <p className="text-muted-foreground text-xs">
            Works with MetaMask, Rabby, and any EIP-1193 wallet
          </p>
        </div>
      ) : result ? (
        <div className="space-y-4">
          {/* Score card */}
          <div className="border-border/40 bg-card rounded-3xl border p-8 text-center">
            <p className="text-muted-foreground mb-2 truncate text-xs">
              {address.slice(0, 6)}…{address.slice(-4)}
            </p>
            <div className="border-primary/30 bg-primary/5 mx-auto mb-4 flex size-32 items-center justify-center rounded-full border-4">
              <div>
                <div
                  className={`font-heading text-5xl font-black ${result.score >= 8 ? "text-emerald-400" : result.score >= 5 ? "text-primary" : "text-amber-400"}`}
                >
                  {result.score}
                </div>
                <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                  / 10
                </div>
              </div>
            </div>
            <h2 className="text-foreground text-xl font-bold">
              {result.score >= 8
                ? "Excellent Diversity"
                : result.score >= 5
                  ? "Good Diversity"
                  : result.score > 0
                    ? "Room to Improve"
                    : "Not Staking Yet"}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {result.totalStaked} MON total staked · {result.delegations.length} validator
              {result.delegations.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Score breakdown */}
          <div className="border-border/40 bg-card rounded-2xl border p-6">
            <div className="bg-muted mb-4 h-3 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all ${result.score >= 8 ? "bg-emerald-400" : result.score >= 5 ? "bg-primary" : "bg-amber-400"}`}
                style={{ width: `${result.score * 10}%` }}
              />
            </div>
            <div className="grid grid-cols-3 text-center text-xs">
              <div>
                <span className="font-bold text-amber-400">0–4</span>
                <br />
                <span className="text-muted-foreground">Concentrated</span>
              </div>
              <div>
                <span className="text-primary font-bold">5–7</span>
                <br />
                <span className="text-muted-foreground">Balanced</span>
              </div>
              <div>
                <span className="font-bold text-emerald-400">8–10</span>
                <br />
                <span className="text-muted-foreground">Excellent</span>
              </div>
            </div>
          </div>

          {/* Delegations */}
          {result.delegations.length > 0 && (
            <div className="border-border/40 bg-card rounded-2xl border p-6">
              <h3 className="text-foreground mb-4 text-sm font-semibold">Your Delegations</h3>
              <div className="space-y-3">
                {result.delegations.map((d) => {
                  const totalNum = parseFloat(result.totalStaked);
                  const pct = totalNum > 0 ? (parseFloat(d.amountFormatted) / totalNum) * 100 : 0;
                  return (
                    <div key={d.validatorAddress}>
                      <div className="mb-1 flex items-center justify-between">
                        <Link
                          href={`/v/${d.slug}`}
                          className="text-foreground text-sm hover:underline"
                        >
                          {d.validatorName}
                        </Link>
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {d.amountFormatted} MON ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Suggestions */}
          <div className="border-border/40 bg-card rounded-2xl border p-6">
            <h3 className="text-foreground mb-4 text-sm font-semibold">💡 Improve Your Score</h3>
            <ul className="space-y-2">
              {result.suggestions.map((s, i) => (
                <li key={i} className="text-muted-foreground flex gap-2 text-sm">
                  <span className="text-primary mt-0.5 shrink-0">→</span>
                  {s}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-3">
              <Link
                href="/find"
                className="bg-primary text-primary-foreground flex flex-1 items-center justify-center rounded-full py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              >
                Find Validators →
              </Link>
              <Link
                href="/validators"
                className="border-border/60 text-muted-foreground hover:text-foreground flex flex-1 items-center justify-center rounded-xl border py-2.5 text-sm transition-colors"
              >
                Browse All
              </Link>
            </div>
          </div>

          <button
            onClick={disconnect}
            className="text-muted-foreground hover:text-foreground w-full text-center text-xs transition-colors"
          >
            Disconnect wallet
          </button>
        </div>
      ) : (
        <div className="border-border/40 bg-card rounded-3xl border p-8 text-center">
          <div className="text-primary mb-4 text-4xl">⏳</div>
          <p className="text-foreground font-semibold">Reading your delegations…</p>
          <p className="text-muted-foreground mt-1 text-sm">Querying Monad chain</p>
        </div>
      )}
    </div>
  );
}
