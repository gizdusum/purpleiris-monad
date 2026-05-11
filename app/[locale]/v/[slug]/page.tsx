import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getWatchtowerOverview } from "@/lib/monad/watchtower";
import { toSlug } from "@/lib/monad/slug";
import { computeBadges, computeOvrBreakdown } from "@/lib/monad/badges";
import type { WatchtowerValidator } from "@/lib/monad/watchtower";
import { CopyButton } from "@/components/features/CopyButton";

export const revalidate = 60;

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const overview = await getWatchtowerOverview();
    const v = overview.validators.find((v) => toSlug(v.name) === slug);
    if (!v) return { title: "Validator Not Found" };
    const score = computeScore(v);
    return {
      title: `${v.name} — OVR ${score} | PurpleIris`,
      description: `${v.name} validator on Monad — ${v.uptime_percentage.toFixed(1)}% uptime, ${v.vdp_flagged_weeks} VDP flags. OVR score: ${score}.`,
      openGraph: {
        title: `${v.name} — OVR ${score}`,
        description: `Monad validator · ${v.uptime_percentage.toFixed(1)}% uptime · ${v.vdp_flagged_weeks === 0 ? "VDP Clean" : `${v.vdp_flagged_weeks} VDP flags`}`,
        images: [`/en/v/${slug}/opengraph-image`],
      },
    };
  } catch {
    return { title: "Validator Profile" };
  }
}

function computeScore(v: WatchtowerValidator): number {
  const vdpPenalty = Math.min(v.vdp_flagged_weeks * 2, 20);
  const alertPenalty = v.alert_level * 5;
  const skipPenalty = Math.min(v.consecutive_skipped * 2, 10);
  return Math.round(
    Math.max(50, Math.min(99, v.uptime_percentage - vdpPenalty - alertPenalty - skipPenalty))
  );
}

function getTier(score: number) {
  if (score >= 95) return "ELITE" as const;
  if (score >= 85) return "PRO" as const;
  if (score >= 75) return "RELIABLE" as const;
  return "STANDARD" as const;
}

const TIER_COLORS = {
  ELITE: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  PRO: "text-slate-300 border-slate-400/30 bg-slate-400/10",
  RELIABLE: "text-orange-400 border-orange-600/30 bg-orange-700/10",
  STANDARD: "text-muted-foreground border-border/40 bg-muted/20",
};

export default async function ValidatorProfilePage({ params }: Props) {
  const { slug, locale } = await params;
  const t = await getTranslations();

  let overview;
  try {
    overview = await getWatchtowerOverview();
  } catch {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-muted-foreground">{t("common.error")}</p>
      </div>
    );
  }

  const validator = overview.validators.find((v) => toSlug(v.name) === slug);
  if (!validator) notFound();

  const sorted = [...overview.validators]
    .filter((v) => v.active_now)
    .sort((a, b) => computeScore(b) - computeScore(a));
  const rank = sorted.findIndex((v) => v.node_id === validator.node_id) + 1;

  const score = computeScore(validator);
  const tier = getTier(score);
  const breakdown = computeOvrBreakdown(validator);
  const badges = computeBadges(validator, rank);

  const embedSrc = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://purpleiris.live"}/${locale}/v/${slug}/embed`;
  const embedCode = `<iframe src="${embedSrc}" width="320" height="200" frameborder="0" style="border-radius:16px;overflow:hidden;" title="${validator.name} — PurpleIris"></iframe>`;

  const vdpCompliance =
    validator.vdp_weeks_analyzed > 0
      ? Math.round(
          ((validator.vdp_weeks_analyzed - validator.vdp_flagged_weeks) /
            validator.vdp_weeks_analyzed) *
            100
        )
      : 100;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Back */}
      <Link
        href="/validators"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        ← Back to Validators
      </Link>

      {/* Hero card */}
      <div className="border-border/40 bg-card mb-6 rounded-3xl border p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={validator.logo}
            alt={validator.name}
            className="size-20 shrink-0 rounded-2xl bg-white/5 object-contain p-1"
          />

          {/* Name + meta */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-widest uppercase ${TIER_COLORS[tier]}`}
              >
                {tier}
              </span>
              {rank > 0 && <span className="text-muted-foreground text-xs">Rank #{rank}</span>}
              {validator.active_now ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Active
                </span>
              ) : (
                <span className="text-xs text-red-400">● Inactive</span>
              )}
            </div>

            <h1 className="font-heading text-foreground text-3xl font-bold">{validator.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {validator.blocks_proposed.toLocaleString()} blocks proposed ·{" "}
              {validator.epochs_observed} epochs
            </p>
          </div>

          {/* OVR */}
          <div className="shrink-0 text-center">
            <div
              className={`font-heading text-7xl leading-none font-black tabular-nums ${
                tier === "ELITE"
                  ? "text-amber-400"
                  : tier === "PRO"
                    ? "text-slate-300"
                    : tier === "RELIABLE"
                      ? "text-orange-400"
                      : "text-muted-foreground"
              }`}
            >
              {score}
            </div>
            <div className="text-muted-foreground mt-1 text-xs font-bold tracking-widest uppercase">
              OVR
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Key metrics */}
        <div className="border-border/40 bg-card rounded-2xl border p-6">
          <h2 className="text-foreground mb-4 text-sm font-semibold">Key Metrics</h2>
          <div className="space-y-3">
            <MetricRow
              label="Uptime"
              value={`${validator.uptime_percentage.toFixed(2)}%`}
              highlight={validator.uptime_percentage >= 99}
              good={validator.uptime_percentage >= 99}
            />
            <MetricRow
              label="Current Epoch"
              value={`${validator.current_epoch_success_rate.toFixed(1)}%`}
              highlight={validator.current_epoch_success_rate >= 95}
              good={validator.current_epoch_success_rate >= 95}
            />
            <MetricRow
              label="VDP Flags"
              value={`${validator.vdp_flagged_weeks} / ${validator.vdp_weeks_analyzed} wks`}
              good={validator.vdp_flagged_weeks === 0}
              bad={validator.vdp_flagged_weeks > 2}
            />
            <MetricRow
              label="VDP Compliance"
              value={`${vdpCompliance}%`}
              highlight={vdpCompliance === 100}
              good={vdpCompliance >= 90}
            />
            <MetricRow
              label="Alert Status"
              value={
                validator.alert_level === 0
                  ? "✓ All Clear"
                  : validator.alert_level === 1
                    ? "⚠ Warning"
                    : "✗ Critical"
              }
              good={validator.alert_level === 0}
              bad={validator.alert_level === 2}
            />
            <MetricRow label="Blocks Proposed" value={validator.blocks_proposed.toLocaleString()} />
            <MetricRow
              label="Blocks Skipped"
              value={validator.blocks_skipped.toLocaleString()}
              bad={validator.blocks_skipped > 100}
            />
            <MetricRow
              label="Consecutive Streak"
              value={`${validator.consecutive_proposed.toLocaleString()} blocks`}
              good={validator.consecutive_proposed > 1000}
            />
          </div>
        </div>

        {/* OVR Breakdown */}
        <div className="border-border/40 bg-card rounded-2xl border p-6">
          <h2 className="text-foreground mb-4 text-sm font-semibold">OVR Breakdown</h2>
          <div className="space-y-4">
            <ScoreBar
              label="Performance"
              score={breakdown.perf}
              description="Uptime × epoch success rate"
            />
            <ScoreBar
              label="Trust"
              score={breakdown.trust}
              description="VDP compliance & alert record"
            />
            <ScoreBar
              label="Reliability"
              score={breakdown.reliability}
              description="Block skip rate & consistency"
            />
            <ScoreBar
              label="Activity"
              score={breakdown.activity}
              description="Epochs observed & longevity"
            />
          </div>

          <div className="border-border/30 mt-5 rounded-xl border bg-black/10 p-4">
            <p className="text-muted-foreground text-xs leading-relaxed">
              OVR = weighted average of all four dimensions. Penalties applied for VDP flags, alert
              levels, and consecutive skips.
            </p>
          </div>
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="border-border/40 bg-card mt-6 rounded-2xl border p-6">
          <h2 className="text-foreground mb-4 text-sm font-semibold">Earned Badges</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`flex items-start gap-3 rounded-xl border p-3.5 ${badge.bg}`}
              >
                <span className="text-2xl leading-none">{badge.emoji}</span>
                <div>
                  <p className={`text-sm font-semibold ${badge.color}`}>{badge.label}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {badge.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Embed widget */}
      <div className="border-border/40 bg-card mt-6 rounded-2xl border p-6">
        <h2 className="text-foreground mb-1 text-sm font-semibold">Embed Widget</h2>
        <p className="text-muted-foreground mb-4 text-xs">
          Show your validator score on your own site
        </p>
        <div className="border-border/40 bg-muted/30 rounded-xl border p-4">
          <code className="text-foreground font-mono text-xs break-all">{embedCode}</code>
        </div>
        <CopyButton text={embedCode} label="Copy embed code" />
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a
          href="https://monad.xyz/stake"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary text-primary-foreground flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          Stake with {validator.name} ↗
        </a>
        <Link
          href="/find"
          className="border-border/60 text-muted-foreground hover:text-foreground flex flex-1 items-center justify-center rounded-full border py-3 text-sm font-medium transition-colors"
        >
          Compare with others →
        </Link>
      </div>

      {/* Claim CTA */}
      <div className="border-border/30 bg-primary/5 mt-6 rounded-2xl border p-6 text-center">
        <p className="text-foreground text-sm font-semibold">
          Are you this validator&apos;s operator?
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Claim this profile with your wallet to add your team info, hardware details, and
          philosophy.
        </p>
        <Link
          href="/operator"
          className="border-primary/40 text-primary hover:bg-primary/10 mt-4 inline-flex items-center gap-1.5 rounded-full border px-5 py-2 text-sm font-semibold transition-all"
        >
          Claim Profile →
        </Link>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  highlight,
  good,
  bad,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  good?: boolean;
  bad?: boolean;
}) {
  const valueClass = bad
    ? "text-red-400"
    : good || highlight
      ? "text-emerald-400"
      : "text-foreground";

  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

function ScoreBar({
  label,
  score,
  description,
}: {
  label: string;
  score: number;
  description: string;
}) {
  const color =
    score >= 90
      ? "bg-emerald-400"
      : score >= 75
        ? "bg-primary"
        : score >= 60
          ? "bg-amber-400"
          : "bg-red-400";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-foreground text-xs font-medium">{label}</span>
        <span className="text-foreground text-xs font-bold tabular-nums">{score}</span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-muted-foreground mt-0.5 text-[10px]">{description}</p>
    </div>
  );
}
