import { Link } from "@/i18n/navigation";
import { GlobeAnimation } from "@/components/features/GlobeAnimation";
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
        {/* Radial glow behind globe */}
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
                See the Network{" "}
                <span className="from-primary bg-gradient-to-r to-[oklch(0.80_0.14_291)] bg-clip-text text-transparent">
                  Through Iris
                </span>
              </h1>

              <p className="text-muted-foreground mt-6 max-w-lg text-lg leading-relaxed">
                Real-time validator intelligence for the Monad blockchain. Track performance,
                decentralization, and stake across all{" "}
                <span className="text-foreground font-semibold">
                  {snapshot.activeValidators} active validators
                </span>{" "}
                worldwide.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/validators"
                  className="bg-primary text-primary-foreground shadow-primary/25 hover:shadow-primary/40 inline-flex h-12 items-center justify-center rounded-full px-8 text-sm font-semibold shadow-lg transition-all hover:opacity-90"
                >
                  Explore Validators →
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

      {/* ── Network Stats Bar ── */}
      <section className="border-border/40 bg-card/40 border-y backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            <StatBar
              label="Active Validators"
              value={snapshot.activeValidators}
              total={snapshot.totalValidators}
              suffix="/ 212"
            />
            <StatBar label="Block Success" value={snapshot.successRate} suffix="%" decimals={1} />
            <StatBar
              label="Decentralization"
              value={snapshot.diversityScore}
              suffix="/10"
              decimals={1}
            />
            <StatBar label="Network Status" value={100} suffix="" status="Online" />
          </div>
        </div>
      </section>

      {/* ── 7-Day Trend ── */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="font-heading text-foreground mb-8 text-2xl font-semibold">
            7-Day Performance
          </h2>
          <div className="border-border/40 bg-card rounded-2xl border p-6">
            <div className="flex h-28 items-end gap-2">
              {snapshot.trend.map((point) => {
                const pct = ((point.successRate - 96) / 4) * 100;
                return (
                  <div key={point.day} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 flex-col justify-end">
                      <div
                        className="bg-primary/70 w-full rounded-t-sm transition-all duration-500"
                        style={{ height: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground text-xs">{point.day}</span>
                    <span className="text-foreground text-xs font-medium tabular-nums">
                      {point.successRate.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="border-border/40 bg-card/20 border-t py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-foreground text-3xl font-bold sm:text-4xl">
              Built for the Monad Ecosystem
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl">
              Whether you delegate or operate, Iris gives you the data edge you need.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-6">
                  <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                  <path
                    d="M12 2a14.5 14.5 0 0 0 0 20M12 2a14.5 14.5 0 0 1 0 20M2 12h20"
                    strokeWidth="1.5"
                  />
                </svg>
              }
              title="200 Validators, One Dashboard"
              desc="Every active Monad validator ranked by performance, commission, uptime, and decentralization score."
              href="/validators"
              cta="Browse Validators"
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-6">
                  <path
                    d="M9 11l3 3L22 4"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              title="60-Second Validator Match"
              desc="Answer five questions about your priorities. Get a personalized shortlist of validators with reasoning."
              href="/find"
              cta="Find My Match"
            />
            <FeatureCard
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-6">
                  <polyline
                    points="22 12 18 12 15 21 9 3 6 12 2 12"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              title="Network Intelligence"
              desc="Track Nakamoto coefficient, geographic distribution, and infrastructure provider concentration in real time."
              href="/insights"
              cta="View Insights"
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
              Join thousands of delegators who use Iris to make informed staking decisions that
              support network decentralization.
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

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-foreground text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{label}</p>
    </div>
  );
}

function StatBar({
  label,
  value,
  suffix,
  total,
  decimals = 0,
  status,
}: {
  label: string;
  value: number;
  suffix: string;
  total?: number;
  decimals?: number;
  status?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">{label}</p>
      <p className="font-heading text-foreground text-2xl font-bold tabular-nums">
        {status ?? `${value.toFixed(decimals)}${suffix}`}
        {total && <span className="text-muted-foreground text-base font-normal"> {suffix}</span>}
      </p>
      {status && (
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs text-emerald-400">All systems operational</span>
        </div>
      )}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  href,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="group border-border/60 bg-card hover:border-primary/30 hover:bg-card/80 flex flex-col gap-4 rounded-2xl border p-6 transition-colors">
      <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
        {icon}
      </div>
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
