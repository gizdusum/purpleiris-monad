import { Link } from "@/i18n/navigation";
import { GlobeAnimation } from "@/components/features/GlobeAnimation";
import { NetworkWeather } from "@/components/features/NetworkWeather";
import { getNetworkStats } from "@/lib/monad/validators";
import { getMockNetworkSnapshot } from "@/lib/monad/mock-data";
import type { NetworkSnapshot } from "@/lib/monad/mock-data";

export const dynamic = "force-dynamic";

async function getNetworkSnapshot(): Promise<NetworkSnapshot> {
  const mock = getMockNetworkSnapshot();
  try {
    const stats = await getNetworkStats();
    return {
      ...mock,
      activeValidators: stats.activeValidators,
      totalValidators: stats.totalValidators,
      successRate: stats.successRate,
      diversityScore: stats.diversityScore,
    };
  } catch {
    return mock;
  }
}

export default async function HomePage() {
  const snapshot = await getNetworkSnapshot();

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 right-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_70%_40%,oklch(0.62_0.26_291/0.18),transparent_65%)]"
        />
        <div
          aria-hidden
          className="from-background pointer-events-none absolute bottom-0 left-0 h-64 w-full bg-gradient-to-t to-transparent"
        />

        <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            {/* Text */}
            <div className="order-2 lg:order-1">
              <div className="border-primary/30 bg-primary/10 text-primary mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wider uppercase">
                <span className="bg-primary size-1.5 animate-pulse rounded-full" />
                Live — Monad Mainnet
              </div>

              <h1 className="font-heading text-foreground text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                Validator scores{" "}
                <span className="from-primary bg-gradient-to-r to-[oklch(0.80_0.14_291)] bg-clip-text text-transparent">
                  like FIFA cards
                </span>
              </h1>

              <p className="text-muted-foreground mt-6 max-w-lg text-lg leading-relaxed">
                The only Monad dashboard that turns raw chain data into a single OVR score — so you
                can pick the best validator without reading a single block explorer.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/validators"
                  className="bg-primary text-primary-foreground shadow-primary/25 hover:shadow-primary/40 inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-semibold shadow-lg transition-all hover:opacity-90"
                >
                  See All OVR Scores →
                </Link>
                <Link
                  href="/find"
                  className="border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5 inline-flex h-12 items-center justify-center rounded-full border px-8 text-sm font-medium transition-colors"
                >
                  Find My Validator
                </Link>
              </div>

              {/* Quick stats */}
              <div className="border-border/40 mt-12 flex gap-8 border-t pt-8">
                <QuickStat label="Active Validators" value={snapshot.activeValidators.toString()} />
                <QuickStat label="Success Rate" value={`${snapshot.successRate.toFixed(1)}%`} />
                <QuickStat
                  label="Diversity Score"
                  value={`${snapshot.diversityScore.toFixed(1)}/10`}
                />
              </div>
            </div>

            {/* Globe */}
            <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
              <GlobeAnimation />
            </div>
          </div>
        </div>
      </section>

      {/* ── Network Weather ── */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-8">
            <p className="text-primary mb-2 text-xs font-semibold tracking-wider uppercase">
              Network Weather
            </p>
            <h2 className="font-heading text-foreground text-2xl font-semibold">
              How is the network right now?
            </h2>
          </div>
          <NetworkWeather data={snapshot} />
        </div>
      </section>

      {/* ── My Stake Score Teaser ── */}
      <section className="border-border/40 bg-card/30 border-y py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center gap-10 lg:flex-row">
            {/* Score preview */}
            <div className="flex shrink-0 flex-col items-center gap-3">
              <div className="border-primary/30 bg-primary/5 relative flex size-40 items-center justify-center rounded-full border-4">
                <div className="text-center">
                  <div className="font-heading text-primary/40 text-6xl font-black">?</div>
                  <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                    Your Score
                  </div>
                </div>
                <div className="absolute -top-2 -right-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-black">
                  NEW
                </div>
              </div>
              <div className="flex gap-1">
                {[3.5, 6.2, 8.0].map((s) => (
                  <div
                    key={s}
                    className="h-1.5 w-10 rounded-full"
                    style={{
                      background:
                        s >= 8
                          ? "oklch(0.62 0.26 291)"
                          : s >= 6
                            ? "oklch(0.62 0.26 291 / 0.5)"
                            : "oklch(0.62 0.26 291 / 0.2)",
                    }}
                  />
                ))}
              </div>
              <p className="text-muted-foreground text-xs">0 — 10 diversity range</p>
            </div>

            {/* Copy */}
            <div className="max-w-xl text-center lg:text-left">
              <p className="text-primary mb-2 text-xs font-semibold tracking-wider uppercase">
                Personal Stake Score
              </p>
              <h2 className="font-heading text-foreground mb-4 text-3xl font-bold">
                How diversified is your stake?
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Connect your wallet and get a Shannon-entropy diversity score for your Monad
                delegations. See exactly which validators you rely on — and where rebalancing would
                help the network most.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/me"
                  className="bg-primary text-primary-foreground inline-flex h-11 items-center justify-center rounded-full px-7 text-sm font-semibold transition-all hover:opacity-90"
                >
                  Check My Score →
                </Link>
                <Link
                  href="/compare"
                  className="border-border/60 text-muted-foreground hover:text-foreground inline-flex h-11 items-center justify-center rounded-full border px-7 text-sm transition-colors"
                >
                  Compare Validators
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── OVR Scoring ── */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10 text-center">
            <p className="text-primary mb-2 text-xs font-semibold tracking-wider uppercase">
              Scoring System
            </p>
            <h2 className="font-heading text-foreground text-3xl font-bold">
              What Makes a Good Validator?
            </h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm">
              4 metrics. One score. Even if you know nothing about staking — the bars tell the
              story.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HealthTile
              icon="⚡"
              label="Performance"
              sublabel="Uptime"
              value={99}
              barClass="bg-emerald-400"
              good="99%+"
              desc="Blocks produced without missing. Higher = better."
            />
            <HealthTile
              icon="🛡"
              label="Trust"
              sublabel="VDP Clean"
              value={88}
              barClass="bg-violet-400"
              good="0 flags"
              desc="Zero Violation Detection Program flags. Clean record = higher trust."
            />
            <HealthTile
              icon="🌍"
              label="Decentralization"
              sublabel="Spread"
              value={85}
              barClass="bg-blue-400"
              good="Global"
              desc="Validates from diverse countries and cloud providers."
            />
            <HealthTile
              icon="🔥"
              label="Reliability"
              sublabel="Streak"
              value={94}
              barClass="bg-amber-400"
              good="10k+"
              desc="Consecutive blocks proposed without a skip. Consistency matters."
            />
          </div>

          <div className="border-border/40 bg-card/40 mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border p-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏆</span>
              <div>
                <p className="text-foreground font-semibold">
                  All 4 dimensions → one OVR score (50–99)
                </p>
                <p className="text-muted-foreground text-sm">
                  Like FIFA player ratings — higher is always better.
                </p>
              </div>
            </div>
            <Link
              href="/validators"
              className="bg-primary text-primary-foreground rounded-full px-6 py-2.5 text-sm font-semibold whitespace-nowrap transition-opacity hover:opacity-90"
            >
              See All Scores →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why Iris? ── */}
      <section className="border-border/40 bg-card/20 border-t py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="text-primary mb-2 text-xs font-semibold tracking-wider uppercase">
              Why Iris?
            </p>
            <h2 className="font-heading text-foreground text-3xl font-bold sm:text-4xl">
              Not just another explorer
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl">
              Explorers show you raw data. Iris translates it into decisions.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <WhyCard
              icon="🎴"
              title="OVR Score"
              desc="Every validator gets a single 50–99 score computed from uptime, VDP flags, alert level, and block streaks. No spreadsheets needed."
              href="/validators"
              cta="Browse Scores"
            />
            <WhyCard
              icon="⚖️"
              title="Head-to-Head Compare"
              desc="Pick two validators and see 17 metrics side-by-side — green highlights the winner on each row automatically."
              href="/compare"
              cta="Try Compare"
            />
            <WhyCard
              icon="📊"
              title="Your Diversity Score"
              desc="Connect your wallet. Get a Shannon entropy score for your delegation spread. Know when you're over-concentrated before it matters."
              href="/me"
              cta="Check My Score"
            />
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="border-primary/20 from-primary/10 via-card to-card relative overflow-hidden rounded-3xl border bg-gradient-to-br p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.62_0.26_291/0.12),transparent_70%)]"
            />
            <h2 className="font-heading text-foreground relative text-3xl font-bold sm:text-4xl">
              Stake smarter. Strengthen Monad.
            </h2>
            <p className="text-muted-foreground relative mx-auto mt-4 max-w-md">
              Join delegators who use Iris to make informed staking decisions that support network
              decentralization.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/find"
                className="bg-primary text-primary-foreground shadow-primary/25 inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-semibold shadow-lg transition-all hover:opacity-90"
              >
                Find Your Validator →
              </Link>
              <Link
                href="/learn"
                className="border-border text-muted-foreground hover:text-foreground inline-flex h-12 items-center justify-center rounded-full border px-8 text-sm font-medium transition-colors"
              >
                Learn About Staking
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function HealthTile({
  icon,
  label,
  sublabel,
  value,
  barClass,
  good,
  desc,
}: {
  icon: string;
  label: string;
  sublabel: string;
  value: number;
  barClass: string;
  good: string;
  desc: string;
}) {
  return (
    <div className="border-border/40 bg-card flex flex-col gap-4 rounded-2xl border p-5">
      <div className="flex items-start justify-between">
        <span className="text-3xl leading-none">{icon}</span>
        <div className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-bold">
          {good}
        </div>
      </div>
      <div>
        <p className="text-foreground text-base font-bold">{label}</p>
        <p className="text-muted-foreground text-xs">{sublabel}</p>
      </div>
      <div className="space-y-1">
        <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full ${barClass} transition-all duration-700`}
            style={{ width: `${value}%` }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-[10px]">0</span>
          <span className="text-foreground text-[10px] font-semibold">{value}/100</span>
        </div>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">{desc}</p>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-foreground text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{label}</p>
    </div>
  );
}

function WhyCard({
  icon,
  title,
  desc,
  href,
  cta,
}: {
  icon: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="group border-border/60 bg-card hover:border-primary/30 hover:bg-card/80 flex flex-col gap-4 rounded-2xl border p-6 transition-colors">
      <span className="text-4xl leading-none">{icon}</span>
      <div className="flex-1">
        <h3 className="font-heading text-foreground mb-2 text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
      </div>
      <Link
        href={href}
        className="text-primary text-sm font-medium transition-opacity hover:opacity-80"
      >
        {cta} →
      </Link>
    </div>
  );
}
