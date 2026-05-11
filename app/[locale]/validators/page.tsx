import { Link } from "@/i18n/navigation";
import { getWatchtowerOverview } from "@/lib/monad/watchtower";
import type { WatchtowerValidator } from "@/lib/monad/watchtower";
import { toSlug } from "@/lib/monad/slug";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Validators" };
export const dynamic = "force-dynamic";

type Region = "NA" | "EU" | "AS" | "OC";

const REGION_MAP: Record<string, Region> = {
  // North America
  "1XP": "NA",
  "Galaxy Digital": "NA",
  "Jump Crypto": "NA",
  "Coinbase Cloud": "NA",
  "Polychain Labs": "NA",
  Allnodes: "NA",
  Chainflow: "NA",
  "Ubik Capital": "NA",
  InfStones: "NA",
  "Lavender Five": "NA",
  "Monad Labs": "NA",
  Stargaze: "NA",
  "Covalent Node": "NA",
  "CoinList Node": "NA",
  "Kraken Node": "NA",
  // Europe
  "01node": "EU",
  "[NODERS]": "EU",
  "Chorus One": "EU",
  "P2P.org": "EU",
  Everstake: "EU",
  Kiln: "EU",
  Luganodes: "EU",
  Blockdaemon: "EU",
  Blockscape: "EU",
  Stakin: "EU",
  "Bware Labs": "EU",
  Moonlet: "EU",
  "AUDIT.one": "EU",
  "Imperator.co": "EU",
  "SG-1": "EU",
  Noderunners: "EU",
  Stakely: "EU",
  Ryabina: "EU",
  DragonStake: "EU",
  IceCreamNode: "EU",
  Anonstake: "EU",
  Figment: "EU",
  "Binance Node": "EU",
  "OKX Validator": "EU",
  "DWF Labs": "EU",
  // Asia Pacific
  Cosmostation: "AS",
  Stakefish: "AS",
  "B-Harvest": "AS",
  NodeStake: "AS",
  "HashKey Cloud": "AS",
  DSRV: "AS",
  StakeWithUs: "AS",
  HashQuark: "AS",
  Forbole: "AS",
  "Nakamoto Pool": "AS",
  // Oceania
  "Pier Two": "OC",
};

const REGION_STYLE: Record<
  Region | "OTHER",
  {
    gradient: string;
    border: string;
    label: string;
    dot: string;
  }
> = {
  NA: {
    gradient: "from-blue-500/12 via-blue-600/4 to-transparent",
    border: "border-blue-500/22",
    label: "🇺🇸 Americas",
    dot: "bg-blue-400",
  },
  EU: {
    gradient: "from-violet-500/12 via-violet-600/4 to-transparent",
    border: "border-violet-500/22",
    label: "🇪🇺 Europe",
    dot: "bg-violet-400",
  },
  AS: {
    gradient: "from-teal-500/12 via-teal-600/4 to-transparent",
    border: "border-teal-500/22",
    label: "🌏 Asia",
    dot: "bg-teal-400",
  },
  OC: {
    gradient: "from-emerald-500/12 via-emerald-600/4 to-transparent",
    border: "border-emerald-500/22",
    label: "🌊 Oceania",
    dot: "bg-emerald-400",
  },
  OTHER: {
    gradient: "from-slate-500/8 via-slate-600/3 to-transparent",
    border: "border-slate-500/15",
    label: "🌐 Global",
    dot: "bg-slate-400",
  },
};

const TIER_SCORE_COLOR = {
  ELITE: "text-amber-400",
  PRO: "text-slate-300",
  RELIABLE: "text-orange-400",
  STANDARD: "text-muted-foreground",
};

const TIER_BADGE = {
  ELITE: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  PRO: "border-slate-400/30 bg-slate-400/10 text-slate-300",
  RELIABLE: "border-orange-600/30 bg-orange-700/10 text-orange-400",
  STANDARD: "border-border/40 bg-muted/20 text-muted-foreground",
};

function getRegion(name: string): Region | "OTHER" {
  return REGION_MAP[name] ?? "OTHER";
}

function computeScore(v: WatchtowerValidator): number {
  const uptime = v.uptime_percentage;
  const vdpPenalty = Math.min(v.vdp_flagged_weeks * 2, 20);
  const alertPenalty = v.alert_level * 5;
  const skipPenalty = Math.min(v.consecutive_skipped * 2, 10);
  return Math.round(Math.max(50, Math.min(99, uptime - vdpPenalty - alertPenalty - skipPenalty)));
}

function getTier(score: number) {
  if (score >= 95) return "ELITE" as const;
  if (score >= 85) return "PRO" as const;
  if (score >= 75) return "RELIABLE" as const;
  return "STANDARD" as const;
}

export default async function ValidatorsPage() {
  let overview;
  try {
    overview = await getWatchtowerOverview();
  } catch {
    return (
      <div className="mx-auto max-w-7xl px-6 py-24 text-center">
        <p className="text-muted-foreground">Could not reach Watchtower API. Try again shortly.</p>
      </div>
    );
  }

  const active = overview.validators
    .filter((v) => v.active_now)
    .map((v, idx) => ({ ...v, rank: idx + 1, score: computeScore(v) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const inactive = overview.validators.filter((v) => !v.active_now);
  const elite = active.filter((v) => getTier(v.score) === "ELITE").length;
  const perfect = active.filter((v) => v.uptime_percentage === 100).length;
  const networkUptime = overview.global_stats.network_uptime.toFixed(2);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-primary mb-2 text-xs font-semibold tracking-wider uppercase">
          Monad Mainnet · Epoch {overview.current_epoch}
        </p>
        <h1 className="font-heading text-foreground text-4xl font-bold">Validator Network</h1>
        <p className="text-muted-foreground mt-2">
          {active.length} active validators · data from{" "}
          <span className="text-foreground font-medium">monad-watchtower.xyz</span>
          {" · "}updated live
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <SummaryCard
          icon="✅"
          label="Active"
          value={active.length.toString()}
          color="text-emerald-400"
        />
        <SummaryCard icon="⭐" label="Elite Tier" value={elite.toString()} color="text-amber-400" />
        <SummaryCard
          icon="💎"
          label="100% Uptime"
          value={perfect.toString()}
          color="text-violet-400"
        />
        <SummaryCard
          icon="📶"
          label="Network Uptime"
          value={`${networkUptime}%`}
          color="text-foreground"
        />
      </div>

      {/* User Tips */}
      <div className="mb-8">
        <p className="text-foreground mb-3 text-sm font-semibold">
          💡 How to pick the right validator for you
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TipCard
            icon="🔰"
            title="New to staking?"
            tip="Pick any ELITE tier — they have near-perfect uptime and zero flags."
          />
          <TipCard
            icon="💰"
            title="Maximize rewards"
            tip="Lower commission = more MON goes to you. Check the fee column."
          />
          <TipCard
            icon="🌍"
            title="Support decentralization"
            tip="Choose a validator ranked #20 or below — smaller validators need delegations."
          />
          <TipCard
            icon="🛡️"
            title="Extra safety"
            tip="Check VDP flags. 0 flags means the validator has never been penalized by Monad."
          />
        </div>
      </div>

      {/* Tier legend */}
      <div className="mb-6 flex flex-wrap gap-3">
        {(
          [
            {
              tier: "ELITE",
              style: "border-amber-500/30 bg-amber-500/10 text-amber-400",
              desc: "Score 95+",
            },
            {
              tier: "PRO",
              style: "border-slate-400/30 bg-slate-400/10 text-slate-300",
              desc: "85–94",
            },
            {
              tier: "RELIABLE",
              style: "border-orange-600/30 bg-orange-700/10 text-orange-400",
              desc: "75–84",
            },
            {
              tier: "STANDARD",
              style: "border-border/40 bg-muted/20 text-muted-foreground",
              desc: "<75",
            },
          ] as const
        ).map((t) => (
          <div
            key={t.tier}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${t.style}`}
          >
            <span>{t.tier}</span>
            <span className="opacity-60">{t.desc}</span>
          </div>
        ))}
      </div>

      {/* Card grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {active.map((v, idx) => (
          <ValidatorCard key={v.node_id} v={v} rank={idx + 1} />
        ))}
      </div>

      {/* Inactive */}
      {inactive.length > 0 && (
        <div className="border-border/40 bg-card/30 mt-10 rounded-2xl border p-5">
          <p className="text-muted-foreground text-sm font-medium">
            🔴 {inactive.length} validators currently inactive
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {inactive.map((v) => (
              <span
                key={v.node_id}
                className="bg-muted/40 text-muted-foreground rounded-full px-3 py-1 text-xs"
              >
                {v.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mt-12 text-center">
        <p className="text-muted-foreground mb-4 text-sm">Not sure which to pick?</p>
        <Link
          href="/find"
          className="bg-primary text-primary-foreground shadow-primary/20 inline-flex h-11 items-center justify-center rounded-full px-8 text-sm font-semibold shadow-lg transition-all hover:opacity-90"
        >
          Find My Perfect Validator →
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="border-border/40 bg-card flex items-center gap-4 rounded-2xl border p-5">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          {label}
        </p>
        <p className={`font-heading mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      </div>
    </div>
  );
}

function TipCard({ icon, title, tip }: { icon: string; title: string; tip: string }) {
  return (
    <div className="border-border/40 bg-card/60 rounded-xl border p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="text-foreground text-sm font-semibold">{title}</span>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">{tip}</p>
    </div>
  );
}

function ValidatorCard({ v, rank }: { v: WatchtowerValidator & { score: number }; rank: number }) {
  const tier = getTier(v.score);
  const region = getRegion(v.name);
  const rs = REGION_STYLE[region];
  const uptimePct = Math.round(v.uptime_percentage);
  const reliabilityPct = Math.round(
    v.vdp_weeks_analyzed > 0
      ? ((v.vdp_weeks_analyzed - v.vdp_flagged_weeks) / v.vdp_weeks_analyzed) * 100
      : 100
  );
  const epochPct = Math.round(v.current_epoch_success_rate);

  return (
    <div
      className={`relative flex flex-col gap-3.5 rounded-2xl border bg-gradient-to-br p-5 transition-all hover:scale-[1.02] hover:shadow-xl ${rs.gradient} ${rs.border}`}
    >
      {/* Region + tier */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${rs.dot}`} />
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
            {rs.label}
          </span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${TIER_BADGE[tier]}`}
        >
          {tier}
        </span>
      </div>

      {/* Logo + name + OVR */}
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={v.logo}
          alt={v.name}
          className="size-10 flex-shrink-0 rounded-xl bg-white/8 object-contain p-0.5"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground truncate text-sm leading-tight font-bold">{v.name}</h3>
          <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">Rank #{rank}</p>
        </div>
        <div className="text-center">
          <div
            className={`font-heading text-4xl leading-none font-black ${TIER_SCORE_COLOR[tier]}`}
          >
            {v.score}
          </div>
          <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
            OVR
          </div>
        </div>
      </div>

      {/* Stat bars */}
      <div className="space-y-1.5">
        <MiniBar label="PERF" value={uptimePct} barClass="bg-emerald-400" />
        <MiniBar label="TRUST" value={reliabilityPct} barClass={rs.dot} />
        <MiniBar label="EPOCH" value={epochPct} barClass="bg-blue-400" />
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/15 p-3 text-center">
        <div>
          <div className="text-foreground text-xs font-bold tabular-nums">
            {v.uptime_percentage.toFixed(1)}%
          </div>
          <div className="text-muted-foreground text-[10px]">Uptime</div>
        </div>
        <div>
          <div
            className={`text-xs font-bold tabular-nums ${v.vdp_flagged_weeks > 0 ? "text-red-400" : "text-emerald-400"}`}
          >
            {v.vdp_flagged_weeks}/{v.vdp_weeks_analyzed}
          </div>
          <div className="text-muted-foreground text-[10px]">VDP</div>
        </div>
        <div>
          <div
            className={`text-xs font-bold ${v.alert_level === 0 ? "text-emerald-400" : v.alert_level === 1 ? "text-amber-400" : "text-red-400"}`}
          >
            {v.alert_level === 0 ? "✓ OK" : v.alert_level === 1 ? "⚠ Warn" : "✗ Alert"}
          </div>
          <div className="text-muted-foreground text-[10px]">Status</div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {v.uptime_percentage === 100 && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            💎 Perfect
          </span>
        )}
        {v.consecutive_proposed > 10_000 && (
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
            🔥 Streak
          </span>
        )}
        {v.vdp_flagged_weeks === 0 && v.vdp_weeks_analyzed > 0 && (
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
            🛡️ Clean
          </span>
        )}
        {rank <= 5 && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            🏆 Top 5
          </span>
        )}
        {v.is_down && (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
            🔴 Offline
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          href={`/v/${toSlug(v.name)}`}
          className="border-border/50 text-muted-foreground hover:text-foreground flex flex-1 items-center justify-center rounded-full border py-2 text-xs font-medium transition-colors"
        >
          View Profile
        </Link>
        <a
          href="https://monad.xyz/stake"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary text-primary-foreground flex flex-1 items-center justify-center rounded-full py-2 text-xs font-semibold transition-opacity hover:opacity-90"
        >
          Stake ↗
        </a>
      </div>
    </div>
  );
}

function MiniBar({ label, value, barClass }: { label: string; value: number; barClass: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-9 text-[10px] font-bold tracking-wider uppercase">
        {label}
      </span>
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${Math.max(2, value)}%` }}
        />
      </div>
      <span className="text-muted-foreground w-7 text-right text-[10px] tabular-nums">{value}</span>
    </div>
  );
}
