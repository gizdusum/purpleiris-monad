import { Link } from "@/i18n/navigation";
import { getWatchtowerOverview } from "@/lib/monad/watchtower";
import type { WatchtowerValidator } from "@/lib/monad/watchtower";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Validators" };
export const dynamic = "force-dynamic";

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

  const tierStyles = {
    ELITE: {
      card: "from-amber-500/15 via-amber-600/5 to-transparent border-amber-500/25",
      score: "text-amber-400",
      badge: "border-amber-500/30 bg-amber-500/15 text-amber-400",
    },
    PRO: {
      card: "from-slate-300/10 via-slate-400/5 to-transparent border-slate-400/20",
      score: "text-slate-300",
      badge: "border-slate-400/30 bg-slate-400/10 text-slate-300",
    },
    RELIABLE: {
      card: "from-orange-600/12 via-orange-700/5 to-transparent border-orange-600/20",
      score: "text-orange-400",
      badge: "border-orange-600/30 bg-orange-700/10 text-orange-400",
    },
    STANDARD: {
      card: "from-card to-card border-border/40",
      score: "text-muted-foreground",
      badge: "border-border/40 bg-muted/20 text-muted-foreground",
    },
  };

  const s = tierStyles[tier];
  const uptimePct = Math.round(v.uptime_percentage);
  const reliabilityPct = Math.round(
    v.vdp_weeks_analyzed > 0
      ? ((v.vdp_weeks_analyzed - v.vdp_flagged_weeks) / v.vdp_weeks_analyzed) * 100
      : 100
  );
  const epochPct = Math.round(v.current_epoch_success_rate);

  return (
    <div
      className={`relative flex flex-col gap-4 rounded-2xl border bg-gradient-to-br p-5 transition-all hover:scale-[1.02] hover:shadow-lg ${s.card}`}
    >
      {/* Logo + name + tier */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={v.logo}
            alt={v.name}
            className="size-8 flex-shrink-0 rounded-lg bg-white/5 object-contain"
            onError={undefined}
          />
          <div className="min-w-0">
            <h3 className="text-foreground truncate text-sm leading-tight font-bold">{v.name}</h3>
            <p className="text-muted-foreground font-mono text-[10px]">#{rank}</p>
          </div>
        </div>
        <span
          className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${s.badge}`}
        >
          {tier}
        </span>
      </div>

      {/* OVR score */}
      <div className="flex items-center gap-3">
        <div className="min-w-[52px] text-center">
          <div className={`font-heading text-5xl leading-none font-black ${s.score}`}>
            {v.score}
          </div>
          <div className="text-muted-foreground mt-1 text-[10px] font-bold tracking-widest uppercase">
            OVR
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <MiniBar label="PERF" value={uptimePct} barClass="bg-emerald-400" />
          <MiniBar label="TRUST" value={reliabilityPct} barClass="bg-violet-400" />
          <MiniBar label="EPOCH" value={epochPct} barClass="bg-blue-400" />
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/10 p-3 text-center">
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
            {v.vdp_flagged_weeks} / {v.vdp_weeks_analyzed}
          </div>
          <div className="text-muted-foreground text-[10px]">VDP Flags</div>
        </div>
        <div>
          <div
            className={`text-xs font-bold ${v.alert_level === 0 ? "text-emerald-400" : v.alert_level === 1 ? "text-amber-400" : "text-red-400"}`}
          >
            {v.alert_level === 0 ? "Clear" : v.alert_level === 1 ? "Warn" : "Alert"}
          </div>
          <div className="text-muted-foreground text-[10px]">Status</div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {v.uptime_percentage === 100 && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            💎 Perfect Uptime
          </span>
        )}
        {v.consecutive_proposed > 10_000 && (
          <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
            🔥 Long Streak
          </span>
        )}
        {v.vdp_flagged_weeks === 0 && v.vdp_weeks_analyzed > 0 && (
          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
            🛡️ Clean Record
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

      {/* Stake button */}
      <a
        href="https://monad.xyz/stake"
        target="_blank"
        rel="noopener noreferrer"
        className="bg-primary text-primary-foreground flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
      >
        Stake Now ↗
      </a>
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
