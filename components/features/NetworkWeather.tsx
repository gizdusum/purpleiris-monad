"use client";

import { useTranslations } from "next-intl";
import type { NetworkSnapshot, WeatherCondition } from "@/lib/monad/mock-data";

const WEATHER_CONFIG: Record<
  WeatherCondition,
  { emoji: string; bg: string; ring: string; text: string }
> = {
  sunny: {
    emoji: "☀️",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    ring: "ring-amber-300 dark:ring-amber-700",
    text: "text-amber-700 dark:text-amber-400",
  },
  cloudy: {
    emoji: "⛅",
    bg: "bg-slate-50 dark:bg-slate-900/40",
    ring: "ring-slate-300 dark:ring-slate-600",
    text: "text-slate-600 dark:text-slate-400",
  },
  stormy: {
    emoji: "⛈️",
    bg: "bg-red-50 dark:bg-red-950/20",
    ring: "ring-red-300 dark:ring-red-700",
    text: "text-red-700 dark:text-red-400",
  },
};

function TrendBar({ value, max }: { value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex h-full flex-col items-center justify-end gap-1">
      <div
        className="bg-primary/70 w-full rounded-t-sm transition-all duration-500"
        style={{ height: `${pct}%` }}
      />
    </div>
  );
}

type Props = { data: NetworkSnapshot };

export function NetworkWeather({ data }: Props) {
  const t = useTranslations("home.networkWeather");
  const cfg = WEATHER_CONFIG[data.condition];

  const maxSuccess = Math.max(...data.trend.map((d) => d.successRate));

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-6">
        <h2 className="font-heading text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("description")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Weather card */}
        <div
          className={`col-span-full flex items-center gap-6 rounded-2xl p-6 ring-1 sm:col-span-2 lg:col-span-1 lg:flex-col lg:items-start ${cfg.bg} ${cfg.ring}`}
        >
          <span className="text-5xl leading-none" role="img" aria-label={data.condition}>
            {cfg.emoji}
          </span>
          <div>
            <p className={`font-heading text-xl font-semibold ${cfg.text}`}>{t(data.condition)}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">Network status</p>
          </div>
        </div>

        {/* Stat: Active validators */}
        <StatCard
          label={t("validators")}
          value={data.activeValidators.toLocaleString()}
          sub="online now"
        />

        {/* Stat: Success rate */}
        <StatCard
          label={t("successRate")}
          value={`${data.successRate.toFixed(1)}%`}
          sub="block production"
          highlight={data.successRate >= 99}
        />

        {/* Stat: Diversity score */}
        <StatCard
          label={t("diversityScore")}
          value={`${data.diversityScore.toFixed(1)}/10`}
          sub="decentralization"
          highlight={data.diversityScore >= 7}
        />
      </div>

      {/* Trend chart */}
      <div className="border-border/60 bg-card mt-4 rounded-2xl border p-6">
        <p className="text-foreground mb-4 text-sm font-medium">{t("trendTitle")}</p>
        <div className="flex h-24 items-end gap-2">
          {data.trend.map((point) => (
            <div key={point.day} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full flex-1">
                <TrendBar value={point.successRate} max={maxSuccess} />
              </div>
              <span className="text-muted-foreground text-xs">{point.day}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className="border-border/60 bg-card flex flex-col justify-between rounded-2xl border p-6">
      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">{label}</p>
      <div className="mt-3">
        <p
          className={`font-heading text-3xl font-semibold tabular-nums ${
            highlight ? "text-primary" : "text-foreground"
          }`}
        >
          {value}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>
      </div>
    </div>
  );
}
