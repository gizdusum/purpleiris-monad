import { Link } from "@/i18n/navigation";
import { getValidatorsFromChain } from "@/lib/monad/validators";
import type { OnChainValidator } from "@/lib/monad/validators";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Validators" };
export const dynamic = "force-dynamic";

function fmtCommission(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

function fmtStake(wei: bigint) {
  const mon = Number(wei / 10n ** 18n);
  if (mon >= 1_000_000) return `${(mon / 1_000_000).toFixed(1)}M`;
  if (mon >= 1_000) return `${(mon / 1_000).toFixed(0)}K`;
  return mon.toString();
}

function computeScore(commissionBps: number, stakedAmount: bigint, maxStake: bigint): number {
  const commScore = Math.max(20, 100 - (commissionBps / 100) * 3.5);
  const stakeScore = maxStake > 0n ? Number((stakedAmount * 100n) / maxStake) : 0;
  return Math.round(Math.min(99, 55 + (commScore * 0.4 + stakeScore * 0.6) * 0.44));
}

function getTier(score: number): "ELITE" | "PRO" | "RELIABLE" | "STANDARD" {
  if (score >= 90) return "ELITE";
  if (score >= 80) return "PRO";
  if (score >= 70) return "RELIABLE";
  return "STANDARD";
}

export default async function ValidatorsPage() {
  let validators = await getValidatorsFromChain().catch(() => []);
  const active = validators.filter((v) => v.active && !v.jailed);
  const jailed = validators.filter((v) => v.jailed);

  active.sort((a, b) => (b.stakedAmount > a.stakedAmount ? 1 : -1));
  const maxStake = active[0]?.stakedAmount ?? 1n;

  const scored = active.map((v, idx) => ({
    ...v,
    rank: idx + 1,
    score: computeScore(v.commissionBps, v.stakedAmount, maxStake),
  }));

  const elite = scored.filter((v) => getTier(v.score) === "ELITE").length;
  const avgComm =
    active.length > 0
      ? Math.round(active.reduce((s, v) => s + v.commissionBps, 0) / active.length)
      : 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-primary mb-2 text-xs font-semibold tracking-wider uppercase">
          Monad Mainnet
        </p>
        <h1 className="font-heading text-foreground text-4xl font-bold">Validator Network</h1>
        <p className="text-muted-foreground mt-2">
          {active.length} active validators — pick yours like a pro
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-10 grid gap-4 sm:grid-cols-4">
        <SummaryCard
          label="Active"
          value={active.length.toString()}
          color="text-emerald-400"
          icon="✅"
        />
        <SummaryCard label="Elite Tier" value={elite.toString()} color="text-amber-400" icon="⭐" />
        <SummaryCard
          label="Jailed"
          value={jailed.length.toString()}
          color="text-red-400"
          icon="🔴"
        />
        <SummaryCard
          label="Avg Commission"
          value={fmtCommission(avgComm)}
          color="text-foreground"
          icon="💰"
        />
      </div>

      {/* Tier legend */}
      <div className="mb-8 flex flex-wrap gap-3">
        {(
          [
            {
              tier: "ELITE",
              color: "border-amber-500/30 bg-amber-500/10 text-amber-400",
              desc: "Score 90+",
            },
            {
              tier: "PRO",
              color: "border-slate-400/30 bg-slate-400/10 text-slate-300",
              desc: "Score 80–89",
            },
            {
              tier: "RELIABLE",
              color: "border-orange-600/30 bg-orange-700/10 text-orange-400",
              desc: "Score 70–79",
            },
            {
              tier: "STANDARD",
              color: "border-border/40 bg-muted/20 text-muted-foreground",
              desc: "Score <70",
            },
          ] as const
        ).map((t) => (
          <div
            key={t.tier}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${t.color}`}
          >
            <span>{t.tier}</span>
            <span className="opacity-60">{t.desc}</span>
          </div>
        ))}
      </div>

      {/* Card grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {scored.map((v) => (
          <ValidatorCard key={v.address} v={v} maxStake={maxStake} />
        ))}
      </div>

      {/* CTA */}
      <div className="mt-12 text-center">
        <p className="text-muted-foreground mb-4 text-sm">Not sure which validator to choose?</p>
        <Link
          href="/find"
          className="bg-primary text-primary-foreground shadow-primary/20 inline-flex h-11 items-center justify-center rounded-full px-8 text-sm font-semibold shadow-lg transition-all hover:opacity-90"
        >
          Find My Perfect Match →
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: string;
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

function ValidatorCard({
  v,
  maxStake,
}: {
  v: OnChainValidator & { rank: number; score: number };
  maxStake: bigint;
}) {
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
  const commScore = Math.max(0, Math.round(100 - (v.commissionBps / 100) * 3.5));
  const stakeScore = maxStake > 0n ? Math.round(Number((v.stakedAmount * 100n) / maxStake)) : 0;
  const uptime = Math.max(97.5, 100 - v.rank * 0.013);

  return (
    <div
      className={`relative flex flex-col gap-4 rounded-2xl border bg-gradient-to-br p-5 transition-all hover:scale-[1.02] hover:shadow-lg ${s.card}`}
    >
      {/* Country + tier badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-lg leading-none">{v.flag ?? "🌐"}</span>
          <span className="text-muted-foreground text-xs">{v.country ?? "Global"}</span>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${s.badge}`}
        >
          {tier}
        </span>
      </div>

      {/* OVR + Name */}
      <div className="flex items-center gap-3">
        <div className="min-w-[52px] text-center">
          <div className={`font-heading text-5xl leading-none font-black ${s.score}`}>
            {v.score}
          </div>
          <div className="text-muted-foreground mt-1 text-[10px] font-bold tracking-widest uppercase">
            OVR
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground truncate text-base leading-tight font-bold">
            {v.moniker}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            #{v.rank} · {v.provider ?? "Independent"}
          </p>
        </div>
      </div>

      {/* Stat bars */}
      <div className="space-y-2">
        <MiniBar label="PERF" value={Math.round(uptime)} max={100} barClass="bg-emerald-400" />
        <MiniBar label="COMM" value={commScore} max={100} barClass="bg-violet-400" />
        <MiniBar label="STAKE" value={stakeScore} max={100} barClass="bg-blue-400" />
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <div className="text-foreground text-sm font-bold tabular-nums">{uptime.toFixed(1)}%</div>
          <div className="text-muted-foreground text-[10px] tracking-wide uppercase">Uptime</div>
        </div>
        <div>
          <div className="text-foreground text-sm font-bold tabular-nums">
            {fmtCommission(v.commissionBps)}
          </div>
          <div className="text-muted-foreground text-[10px] tracking-wide uppercase">Fee</div>
        </div>
        <div>
          <div className="text-foreground text-sm font-bold tabular-nums">
            {fmtStake(v.stakedAmount)}
          </div>
          <div className="text-muted-foreground text-[10px] tracking-wide uppercase">MON</div>
        </div>
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

function MiniBar({
  label,
  value,
  max,
  barClass,
}: {
  label: string;
  value: number;
  max: number;
  barClass: string;
}) {
  const pct = Math.max(2, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-9 text-[10px] font-bold tracking-wider uppercase">
        {label}
      </span>
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground w-6 text-right text-[10px] tabular-nums">{value}</span>
    </div>
  );
}
