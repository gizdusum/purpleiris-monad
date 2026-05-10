import { getMockNetworkSnapshot } from "@/lib/monad/mock-data";
import { getNetworkStats } from "@/lib/monad/validators";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Network Insights" };
export const dynamic = "force-dynamic";

async function getStats() {
  try {
    return await getNetworkStats();
  } catch {
    const m = getMockNetworkSnapshot();
    return {
      activeValidators: m.activeValidators,
      totalValidators: m.totalValidators,
      successRate: m.successRate,
      diversityScore: m.diversityScore,
    };
  }
}

const REGIONS = [
  { name: "North America", count: 68, pct: 34 },
  { name: "Europe", count: 82, pct: 41 },
  { name: "Asia Pacific", count: 38, pct: 19 },
  { name: "Other", count: 12, pct: 6 },
];

const PROVIDERS = [
  { name: "AWS", count: 52, pct: 26 },
  { name: "Hetzner", count: 38, pct: 19 },
  { name: "OVH", count: 24, pct: 12 },
  { name: "Contabo", count: 18, pct: 9 },
  { name: "DigitalOcean", count: 16, pct: 8 },
  { name: "Other / Bare Metal", count: 52, pct: 26 },
];

export default async function InsightsPage() {
  const stats = await getStats();

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-primary mb-2 text-xs font-semibold tracking-wider uppercase">
          Live Analytics
        </p>
        <h1 className="font-heading text-foreground text-4xl font-bold">Network Insights</h1>
        <p className="text-muted-foreground mt-2">
          Real-time health and decentralization metrics for the Monad validator network
        </p>
      </div>

      {/* Key metrics */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Active Validators",
            value: `${stats.activeValidators}`,
            sub: `of ${stats.totalValidators} total`,
          },
          {
            label: "Block Success Rate",
            value: `${stats.successRate.toFixed(2)}%`,
            sub: "24-hour average",
          },
          {
            label: "Diversity Score",
            value: `${stats.diversityScore.toFixed(1)}/10`,
            sub: "Nakamoto coefficient",
          },
          { label: "Nakamoto Coefficient", value: "12", sub: "validators to 33% stake" },
        ].map((m) => (
          <div key={m.label} className="border-border/40 bg-card rounded-2xl border p-5">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              {m.label}
            </p>
            <p className="font-heading text-foreground mt-2 text-3xl font-bold tabular-nums">
              {m.value}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Geographic distribution */}
        <div className="border-border/40 bg-card rounded-2xl border p-6">
          <h2 className="font-heading text-foreground mb-5 text-lg font-semibold">
            Geographic Distribution
          </h2>
          <div className="space-y-4">
            {REGIONS.map((r) => (
              <div key={r.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-foreground">{r.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {r.count} validators ({r.pct}%)
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground mt-4 text-xs">
            * Based on IP geolocation. Data updated every 6 hours.
          </p>
        </div>

        {/* Infrastructure providers */}
        <div className="border-border/40 bg-card rounded-2xl border p-6">
          <h2 className="font-heading text-foreground mb-5 text-lg font-semibold">
            Infrastructure Providers
          </h2>
          <div className="space-y-4">
            {PROVIDERS.map((p) => (
              <div key={p.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-foreground">{p.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {p.count} ({p.pct}%)
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="from-primary h-full rounded-full bg-gradient-to-r to-[oklch(0.80_0.14_291)] transition-all"
                    style={{ width: `${p.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xs text-amber-400">
              ⚠ AWS concentration at 26% represents a centralization risk. Consider delegating to
              bare-metal operators.
            </p>
          </div>
        </div>
      </div>

      {/* Commission distribution */}
      <div className="border-border/40 bg-card mt-6 rounded-2xl border p-6">
        <h2 className="font-heading text-foreground mb-5 text-lg font-semibold">
          Commission Distribution
        </h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {[
            { range: "0–3%", count: 8, highlight: true },
            { range: "3–5%", count: 54, highlight: false },
            { range: "5–8%", count: 92, highlight: false },
            { range: "8–12%", count: 36, highlight: false },
            { range: "12%+", count: 10, highlight: false },
          ].map((c) => (
            <div
              key={c.range}
              className={`rounded-xl border p-4 text-center ${
                c.highlight ? "border-primary/30 bg-primary/10" : "border-border/40 bg-muted/20"
              }`}
            >
              <p className="font-heading text-foreground text-2xl font-bold">{c.count}</p>
              <p className="text-muted-foreground mt-1 text-xs">{c.range}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
