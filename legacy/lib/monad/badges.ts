import type { WatchtowerValidator } from "./watchtower";

export type Badge = {
  id: string;
  emoji: string;
  label: string;
  description: string;
  color: string;
  bg: string;
};

type BadgeDef = Badge & { check: (v: WatchtowerValidator, rank: number) => boolean };

const BADGE_DEFS: BadgeDef[] = [
  {
    id: "perfect_uptime",
    emoji: "💎",
    label: "Perfect Uptime",
    description: "100% uptime — never missed a block",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    check: (v) => v.uptime_percentage === 100,
  },
  {
    id: "vdp_clean",
    emoji: "🛡️",
    label: "VDP Clean",
    description: "Zero Violation Detection flags in the entire observed window",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    check: (v) => v.vdp_flagged_weeks === 0 && v.vdp_weeks_analyzed > 0,
  },
  {
    id: "top5",
    emoji: "🏆",
    label: "Top 5",
    description: "Ranked in the top 5 validators by OVR score",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    check: (_v, rank) => rank <= 5,
  },
  {
    id: "top20",
    emoji: "⭐",
    label: "Top 20",
    description: "Ranked in the top 20 validators by OVR score",
    color: "text-amber-300",
    bg: "bg-amber-500/8 border-amber-500/15",
    check: (_v, rank) => rank <= 20 && rank > 5,
  },
  {
    id: "hot_streak",
    emoji: "🔥",
    label: "On Fire",
    description: "10,000+ consecutive blocks proposed without missing",
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
    check: (v) => v.consecutive_proposed >= 10_000,
  },
  {
    id: "iron_streak",
    emoji: "⚡",
    label: "Iron Streak",
    description: "1,000+ consecutive blocks proposed",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    check: (v) => v.consecutive_proposed >= 1_000 && v.consecutive_proposed < 10_000,
  },
  {
    id: "battle_tested",
    emoji: "🎖️",
    label: "Battle Tested",
    description: "Observed across 100+ epochs — long-term proven reliability",
    color: "text-slate-300",
    bg: "bg-slate-500/10 border-slate-500/20",
    check: (v) => v.epochs_observed >= 100,
  },
  {
    id: "network_anchor",
    emoji: "⚓",
    label: "Network Anchor",
    description: "50,000+ blocks proposed — a foundational pillar of the network",
    color: "text-teal-400",
    bg: "bg-teal-500/10 border-teal-500/20",
    check: (v) => v.blocks_proposed >= 50_000,
  },
];

export function computeBadges(v: WatchtowerValidator, rank: number): Badge[] {
  return BADGE_DEFS.filter((def) => def.check(v, rank)).map(({ check: _check, ...badge }) => badge);
}

export function computeOvrBreakdown(v: WatchtowerValidator) {
  const perf = Math.round(
    Math.max(50, Math.min(99, v.uptime_percentage * 0.7 + v.current_epoch_success_rate * 0.3))
  );
  const trust = Math.round(
    Math.max(50, Math.min(99, 99 - Math.min(v.vdp_flagged_weeks * 5, 30) - v.alert_level * 10))
  );
  const reliability = Math.round(
    Math.max(50, Math.min(99, 99 - Math.min(v.consecutive_skipped * 2, 30)))
  );
  const activity = Math.round(Math.max(50, Math.min(99, Math.min(v.epochs_observed + 50, 99))));
  return { perf, trust, reliability, activity };
}
