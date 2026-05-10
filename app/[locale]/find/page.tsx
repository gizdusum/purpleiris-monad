import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Find Your Validator" };

const PRIORITIES = [
  {
    id: "decentralization",
    label: "Decentralization",
    desc: "Choose validators that strengthen Monad's censorship resistance",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="size-5"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20M12 2a14.5 14.5 0 0 1 0 20M2 12h20" />
      </svg>
    ),
  },
  {
    id: "performance",
    label: "High Performance",
    desc: "Prioritize validators with the best uptime and block success rates",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="size-5"
        strokeWidth="1.5"
      >
        <polyline
          points="22 12 18 12 15 21 9 3 6 12 2 12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "commission",
    label: "Low Commission",
    desc: "Maximize your staking rewards by selecting low-fee validators",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="size-5"
        strokeWidth="1.5"
      >
        <line x1="12" y1="1" x2="12" y2="23" strokeLinecap="round" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "reputation",
    label: "Established Teams",
    desc: "Stake with validators who have proven track records and community trust",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="size-5"
        strokeWidth="1.5"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
];

export default function FindPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wider uppercase">
          <span className="bg-primary size-1.5 rounded-full" />
          Delegator Wizard
        </div>
        <h1 className="font-heading text-foreground text-4xl font-bold sm:text-5xl">
          Find Your Perfect Validator
        </h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-md">
          Answer a few questions about your staking priorities and we will match you with the best
          validators for your goals.
        </p>
      </div>

      {/* Step preview */}
      <div className="border-border/40 bg-card mb-12 overflow-hidden rounded-3xl border">
        <div className="border-border/40 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full ${s === 1 ? "bg-primary w-8" : "bg-muted w-4"}`}
                />
              ))}
            </div>
            <span className="text-muted-foreground text-xs">Step 1 of 5</span>
          </div>
        </div>

        <div className="p-8">
          <h2 className="font-heading text-foreground mb-2 text-xl font-semibold">
            What matters most to you?
          </h2>
          <p className="text-muted-foreground mb-6 text-sm">Select your top priority</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                className="group border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-primary/5 flex items-start gap-4 rounded-2xl border p-4 text-left transition-all"
              >
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                  {p.icon}
                </div>
                <div>
                  <p className="text-foreground font-medium">{p.label}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{p.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="border-border/40 flex items-center justify-between border-t px-8 py-4">
          <span className="text-muted-foreground text-sm">Takes about 60 seconds</span>
          <button className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center rounded-full px-6 text-sm font-semibold transition-all hover:opacity-90">
            Continue →
          </button>
        </div>
      </div>

      {/* What you'll get */}
      <div className="border-border/40 bg-card/50 rounded-2xl border p-6">
        <h3 className="font-heading text-foreground mb-4 text-lg font-semibold">
          You will receive
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: "🎯",
              label: "Personalized shortlist",
              desc: "Top 5 validators matched to your profile",
            },
            {
              icon: "📊",
              label: "Comparison view",
              desc: "Side-by-side metrics for easy decision",
            },
            { icon: "📖", label: "Reasoning", desc: "Clear explanation of why each was chosen" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-2">
              <span className="text-2xl">{item.icon}</span>
              <p className="text-foreground text-sm font-medium">{item.label}</p>
              <p className="text-muted-foreground text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/validators" className="text-muted-foreground hover:text-foreground text-sm">
          Browse all validators instead →
        </Link>
      </div>
    </div>
  );
}
