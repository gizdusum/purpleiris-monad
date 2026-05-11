import type { Metadata } from "next";
import { getWatchtowerOverview } from "@/lib/monad/watchtower";
import { toSlug } from "@/lib/monad/slug";
import { computeBadges, computeOvrBreakdown } from "@/lib/monad/badges";
import { Link } from "@/i18n/navigation";
import type { WatchtowerValidator } from "@/lib/monad/watchtower";

export const revalidate = 60;
export const metadata: Metadata = { title: "Compare Validators | PurpleIris" };

type Props = { searchParams: Promise<{ a?: string; b?: string }> };

function computeScore(v: WatchtowerValidator): number {
  const vdpPenalty = Math.min(v.vdp_flagged_weeks * 2, 20);
  const alertPenalty = v.alert_level * 5;
  const skipPenalty = Math.min(v.consecutive_skipped * 2, 10);
  return Math.round(
    Math.max(50, Math.min(99, v.uptime_percentage - vdpPenalty - alertPenalty - skipPenalty))
  );
}

function getTier(score: number) {
  if (score >= 95) return "ELITE";
  if (score >= 85) return "PRO";
  if (score >= 75) return "RELIABLE";
  return "STANDARD";
}

export default async function ComparePage({ searchParams }: Props) {
  const { a, b } = await searchParams;

  let overview;
  try {
    overview = await getWatchtowerOverview();
  } catch {
    return (
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="text-muted-foreground">Could not reach Watchtower API. Try again shortly.</p>
      </div>
    );
  }

  const active = [...overview.validators]
    .filter((v) => v.active_now)
    .sort((x, y) => computeScore(y) - computeScore(x));

  const va = a ? overview.validators.find((v) => toSlug(v.name) === a) : null;
  const vb = b ? overview.validators.find((v) => toSlug(v.name) === b) : null;

  const rankA = va ? active.findIndex((v) => v.node_id === va.node_id) + 1 : 0;
  const rankB = vb ? active.findIndex((v) => v.node_id === vb.node_id) + 1 : 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/validators"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          ← All Validators
        </Link>
        <h1 className="font-heading text-foreground text-3xl font-bold">Compare Validators</h1>
        <p className="text-muted-foreground mt-1 text-sm">Side-by-side metric comparison</p>
      </div>

      {/* Picker row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <ValidatorPicker
          label="Validator A"
          selected={va?.name}
          slug={a}
          validators={active}
          paramKey="a"
          otherSlug={b}
        />
        <ValidatorPicker
          label="Validator B"
          selected={vb?.name}
          slug={b}
          validators={active}
          paramKey="b"
          otherSlug={a}
        />
      </div>

      {va && vb ? (
        <CompareTable va={va} vb={vb} rankA={rankA} rankB={rankB} />
      ) : (
        <div className="border-border/40 bg-card rounded-2xl border p-12 text-center">
          <p className="text-muted-foreground mb-4 text-4xl">⚖️</p>
          <p className="text-foreground font-semibold">Select two validators to compare</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Use the dropdowns above to pick validators A and B
          </p>
        </div>
      )}
    </div>
  );
}

function ValidatorPicker({
  label,
  selected,
  slug: _slug,
  validators,
  paramKey,
  otherSlug,
}: {
  label: string;
  selected?: string;
  slug?: string;
  validators: WatchtowerValidator[];
  paramKey: "a" | "b";
  otherSlug?: string;
}) {
  const otherParam = paramKey === "a" ? "b" : "a";

  return (
    <div className="border-border/40 bg-card rounded-2xl border p-5">
      <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
        {label}
      </p>
      {selected ? (
        <div className="flex items-center justify-between">
          <span className="text-foreground font-semibold">{selected}</span>
          <Link
            href={`/compare?${otherParam}=${otherSlug ?? ""}`}
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            Change
          </Link>
        </div>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {validators.slice(0, 50).map((v) => {
            const s = toSlug(v.name);
            const url =
              paramKey === "a"
                ? `/compare?a=${s}${otherSlug ? `&b=${otherSlug}` : ""}`
                : `/compare?b=${s}${otherSlug ? `&a=${otherSlug}` : ""}`;
            return (
              <Link
                key={v.node_id}
                href={url}
                className="hover:bg-primary/10 hover:text-primary flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.logo}
                  alt={v.name}
                  className="size-6 rounded bg-white/5 object-contain"
                />
                <span>{v.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompareTable({
  va,
  vb,
  rankA,
  rankB,
}: {
  va: WatchtowerValidator;
  vb: WatchtowerValidator;
  rankA: number;
  rankB: number;
}) {
  const scoreA = computeScore(va);
  const scoreB = computeScore(vb);
  const bdA = computeOvrBreakdown(va);
  const bdB = computeOvrBreakdown(vb);
  const badgesA = computeBadges(va, rankA);
  const badgesB = computeBadges(vb, rankB);

  const rows: {
    label: string;
    a: string | number;
    b: string | number;
    higherIsBetter?: boolean;
  }[] = [
    { label: "OVR Score", a: scoreA, b: scoreB, higherIsBetter: true },
    { label: "Tier", a: getTier(scoreA), b: getTier(scoreB) },
    { label: "Rank", a: rankA > 0 ? `#${rankA}` : "—", b: rankB > 0 ? `#${rankB}` : "—" },
    {
      label: "Uptime %",
      a: va.uptime_percentage.toFixed(2),
      b: vb.uptime_percentage.toFixed(2),
      higherIsBetter: true,
    },
    {
      label: "Current Epoch",
      a: `${va.current_epoch_success_rate.toFixed(1)}%`,
      b: `${vb.current_epoch_success_rate.toFixed(1)}%`,
      higherIsBetter: true,
    },
    { label: "VDP Flags", a: va.vdp_flagged_weeks, b: vb.vdp_flagged_weeks, higherIsBetter: false },
    { label: "VDP Weeks", a: va.vdp_weeks_analyzed, b: vb.vdp_weeks_analyzed },
    {
      label: "Alert Level",
      a: va.alert_level === 0 ? "✓ OK" : va.alert_level === 1 ? "⚠ Warning" : "✗ Critical",
      b: vb.alert_level === 0 ? "✓ OK" : vb.alert_level === 1 ? "⚠ Warning" : "✗ Critical",
    },
    {
      label: "Blocks Proposed",
      a: va.blocks_proposed.toLocaleString(),
      b: vb.blocks_proposed.toLocaleString(),
      higherIsBetter: true,
    },
    {
      label: "Blocks Skipped",
      a: va.blocks_skipped.toLocaleString(),
      b: vb.blocks_skipped.toLocaleString(),
      higherIsBetter: false,
    },
    {
      label: "Consecutive Streak",
      a: va.consecutive_proposed.toLocaleString(),
      b: vb.consecutive_proposed.toLocaleString(),
      higherIsBetter: true,
    },
    {
      label: "Epochs Observed",
      a: va.epochs_observed,
      b: vb.epochs_observed,
      higherIsBetter: true,
    },
    { label: "OVR — Performance", a: bdA.perf, b: bdB.perf, higherIsBetter: true },
    { label: "OVR — Trust", a: bdA.trust, b: bdB.trust, higherIsBetter: true },
    { label: "OVR — Reliability", a: bdA.reliability, b: bdB.reliability, higherIsBetter: true },
    { label: "OVR — Activity", a: bdA.activity, b: bdB.activity, higherIsBetter: true },
  ];

  return (
    <div className="space-y-6">
      {/* Hero comparison */}
      <div className="border-border/40 bg-card grid grid-cols-3 overflow-hidden rounded-2xl border">
        <ValidatorHero v={va} score={scoreA} rank={rankA} badges={badgesA} />
        <div className="border-border/40 flex items-center justify-center border-x">
          <span className="text-muted-foreground text-xs font-bold tracking-widest">VS</span>
        </div>
        <ValidatorHero v={vb} score={scoreB} rank={rankB} badges={badgesB} reverse />
      </div>

      {/* Table */}
      <div className="border-border/40 bg-card overflow-hidden rounded-2xl border">
        <div className="border-border/40 bg-muted/20 grid grid-cols-3 border-b px-6 py-3 text-xs font-semibold">
          <span className="text-foreground truncate">{va.name}</span>
          <span className="text-muted-foreground text-center">Metric</span>
          <span className="text-foreground truncate text-right">{vb.name}</span>
        </div>
        {rows.map((row) => (
          <CompareRow key={row.label} row={row} />
        ))}
      </div>

      {/* Actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={`/v/${toSlug(va.name)}`}
          className="border-border/40 text-foreground hover:bg-muted flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-colors"
        >
          View {va.name} Profile →
        </Link>
        <Link
          href={`/v/${toSlug(vb.name)}`}
          className="border-border/40 text-foreground hover:bg-muted flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-colors"
        >
          View {vb.name} Profile →
        </Link>
      </div>
    </div>
  );
}

function ValidatorHero({
  v,
  score,
  rank,
  badges,
  reverse,
}: {
  v: WatchtowerValidator;
  score: number;
  rank: number;
  badges: { emoji: string; label: string }[];
  reverse?: boolean;
}) {
  const tier = getTier(score);
  const tierColor =
    tier === "ELITE"
      ? "text-amber-400"
      : tier === "PRO"
        ? "text-slate-300"
        : tier === "RELIABLE"
          ? "text-orange-400"
          : "text-muted-foreground";

  return (
    <div className={`flex flex-col items-center gap-3 p-6 text-center ${reverse ? "" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={v.logo} alt={v.name} className="size-14 rounded-xl bg-white/5 object-contain p-1" />
      <div>
        <p className="text-foreground text-sm font-bold">{v.name}</p>
        {rank > 0 && <p className="text-muted-foreground text-xs">Rank #{rank}</p>}
      </div>
      <div className={`font-heading text-5xl font-black tabular-nums ${tierColor}`}>{score}</div>
      <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
        OVR
      </span>
      <div className="flex flex-wrap justify-center gap-1">
        {badges.slice(0, 3).map((badge) => (
          <span key={badge.label} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px]">
            {badge.emoji} {badge.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function CompareRow({
  row,
}: {
  row: { label: string; a: string | number; b: string | number; higherIsBetter?: boolean };
}) {
  const numA = typeof row.a === "number" ? row.a : parseFloat(String(row.a));
  const numB = typeof row.b === "number" ? row.b : parseFloat(String(row.b));
  const hasNum = !isNaN(numA) && !isNaN(numB) && row.higherIsBetter !== undefined;

  let aClass = "text-foreground";
  let bClass = "text-foreground";

  if (hasNum && numA !== numB) {
    const aWins = row.higherIsBetter ? numA > numB : numA < numB;
    aClass = aWins ? "text-emerald-400 font-bold" : "text-red-400";
    bClass = aWins ? "text-red-400" : "text-emerald-400 font-bold";
  }

  return (
    <div className="border-border/20 grid grid-cols-3 border-b px-6 py-3 last:border-b-0">
      <span className={`text-sm tabular-nums ${aClass}`}>{String(row.a)}</span>
      <span className="text-muted-foreground text-center text-xs">{row.label}</span>
      <span className={`text-right text-sm tabular-nums ${bClass}`}>{String(row.b)}</span>
    </div>
  );
}
