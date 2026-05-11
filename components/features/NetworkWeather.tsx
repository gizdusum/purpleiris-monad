"use client";

import type { NetworkSnapshot } from "@/lib/monad/mock-data";

type WeatherState = {
  icon: string;
  label: string;
  desc: string;
  color: string;
  bg: string;
};

function getWeather(successRate: number): WeatherState {
  if (successRate >= 99)
    return {
      icon: "☀️",
      label: "Sunny",
      desc: "All Clear — every validator firing perfectly",
      color: "text-amber-400",
      bg: "bg-amber-400/10 border-amber-400/20",
    };
  if (successRate >= 97)
    return {
      icon: "🌤",
      label: "Partly Cloudy",
      desc: "Mostly Healthy — a few validators drifting",
      color: "text-sky-400",
      bg: "bg-sky-400/10 border-sky-400/20",
    };
  if (successRate >= 94)
    return {
      icon: "🌥",
      label: "Cloudy",
      desc: "Some Turbulence — several validators below par",
      color: "text-slate-400",
      bg: "bg-slate-400/10 border-slate-400/20",
    };
  if (successRate >= 90)
    return {
      icon: "🌧",
      label: "Rainy",
      desc: "Network Stress — multiple validators underperforming",
      color: "text-blue-400",
      bg: "bg-blue-400/10 border-blue-400/20",
    };
  return {
    icon: "⛈",
    label: "Stormy",
    desc: "Critical — significant network degradation detected",
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/20",
  };
}

type Props = { data: NetworkSnapshot };

export function NetworkWeather({ data }: Props) {
  const weather = getWeather(data.successRate);

  return (
    <div className="space-y-4">
      {/* Weather state hero */}
      <div className={`rounded-2xl border p-6 ${weather.bg}`}>
        <div className="flex items-center gap-4">
          <span className="text-5xl leading-none">{weather.icon}</span>
          <div>
            <p className={`text-lg font-bold ${weather.color}`}>{weather.label}</p>
            <p className="text-muted-foreground text-sm">{weather.desc}</p>
          </div>
          <div className="ml-auto text-right">
            <p className={`font-heading text-3xl font-black tabular-nums ${weather.color}`}>
              {data.successRate.toFixed(1)}%
            </p>
            <p className="text-muted-foreground text-xs">success rate</p>
          </div>
        </div>

        {/* Weather scale */}
        <div className="mt-4 flex items-center gap-1 text-xs">
          {(
            [
              { icon: "⛈", label: "Stormy", pct: 0 },
              { icon: "🌧", label: "Rainy", pct: 25 },
              { icon: "🌥", label: "Cloudy", pct: 50 },
              { icon: "🌤", label: "Partly", pct: 75 },
              { icon: "☀️", label: "Sunny", pct: 100 },
            ] as const
          ).map((s) => (
            <div key={s.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-base leading-none">{s.icon}</span>
              <span className="text-muted-foreground hidden sm:block">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Active Validators"
          value={data.activeValidators.toLocaleString()}
          sub="online now"
        />
        <StatCard
          label="Success Rate"
          value={`${data.successRate.toFixed(1)}%`}
          sub="block production"
          highlight={data.successRate >= 99}
        />
        <StatCard
          label="Diversity Score"
          value={`${data.diversityScore.toFixed(1)}/10`}
          sub="decentralization"
          highlight={data.diversityScore >= 7}
        />
      </div>

      {/* 7-day trend */}
      <div className="border-border/40 bg-card rounded-2xl border p-5">
        <p className="text-foreground mb-4 text-sm font-medium">7-Day Trend</p>
        <div className="flex h-20 items-end gap-2">
          {data.trend.map((point) => {
            const pct = Math.round(((point.successRate - 96) / 4) * 100);
            return (
              <div key={point.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 flex-col justify-end">
                  <div
                    className="bg-primary/70 w-full rounded-t-sm"
                    style={{ height: `${Math.max(4, pct)}%` }}
                  />
                </div>
                <span className="text-muted-foreground text-[10px]">{point.day}</span>
                <span className="text-foreground text-[10px] tabular-nums">
                  {point.successRate.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
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
    <div className="border-border/40 bg-card flex flex-col justify-between rounded-2xl border p-4">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="mt-2">
        <p
          className={`font-heading text-2xl font-bold tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}
        >
          {value}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>
      </div>
    </div>
  );
}
