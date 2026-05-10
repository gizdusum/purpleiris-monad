"use client";

import type { NetworkSnapshot } from "@/lib/monad/mock-data";

type Props = { data: NetworkSnapshot };

export function NetworkWeather({ data }: Props) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <div className="mb-6">
        <h2 className="font-heading text-foreground text-2xl font-semibold tracking-tight">
          Network Health
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Live health of the Monad validator network
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Active Validators"
          value={data.activeValidators.toLocaleString()}
          sub="online now"
        />
        <StatCard
          label="24h Success Rate"
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

      <div className="border-border/60 bg-card mt-4 rounded-2xl border p-6">
        <p className="text-foreground mb-4 text-sm font-medium">7-Day Trend</p>
        <div className="flex h-24 items-end gap-2">
          {data.trend.map((point) => {
            const pct = Math.round(((point.successRate - 96) / 4) * 100);
            return (
              <div key={point.day} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 flex-col justify-end">
                  <div
                    className="bg-primary/70 w-full rounded-t-sm"
                    style={{ height: `${Math.max(4, pct)}%` }}
                  />
                </div>
                <span className="text-muted-foreground text-xs">{point.day}</span>
              </div>
            );
          })}
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
          className={`font-heading text-3xl font-semibold tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}
        >
          {value}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>
      </div>
    </div>
  );
}
