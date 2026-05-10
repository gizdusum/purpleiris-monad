"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import type { WatchtowerValidator } from "@/lib/monad/watchtower";

type Priority = "decentralization" | "performance" | "commission" | "reputation";
type Experience = "beginner" | "intermediate" | "expert";
type Size = "any" | "large" | "medium" | "small";

const PRIORITIES: { id: Priority; label: string; desc: string; icon: string }[] = [
  {
    id: "decentralization",
    label: "Decentralization",
    desc: "Support censorship resistance — pick validators that strengthen the network",
    icon: "🌍",
  },
  {
    id: "performance",
    label: "High Performance",
    desc: "Best uptime and block success rates — maximum reliability",
    icon: "⚡",
  },
  {
    id: "commission",
    label: "Low Commission",
    desc: "Maximize your staking rewards by selecting low-fee validators",
    icon: "💰",
  },
  {
    id: "reputation",
    label: "Proven Teams",
    desc: "Stake with validators that have zero VDP flags and long track records",
    icon: "🛡️",
  },
];

const EXPERIENCES: { id: Experience; label: string; desc: string; icon: string }[] = [
  {
    id: "beginner",
    label: "First time staking",
    desc: "I want the safest, easiest pick",
    icon: "🌱",
  },
  { id: "intermediate", label: "Staked before", desc: "I understand the basics", icon: "⚡" },
  { id: "expert", label: "Power user", desc: "I want full control and data", icon: "🏆" },
];

const SIZES: { id: Size; label: string; desc: string; icon: string }[] = [
  { id: "any", label: "No preference", desc: "Show me the best overall", icon: "🌐" },
  {
    id: "large",
    label: "Top validators",
    desc: "Highest stake, most established (#1–#20)",
    icon: "🏛️",
  },
  {
    id: "medium",
    label: "Mid-tier",
    desc: "Good balance of trust and decentralization (#21–#60)",
    icon: "⚖️",
  },
  {
    id: "small",
    label: "Smaller validators",
    desc: "Support decentralization, need more delegations (#61+)",
    icon: "🤝",
  },
];

function getRecommendations(
  validators: WatchtowerValidator[],
  priority: Priority,
  experience: Experience,
  size: Size
): WatchtowerValidator[] {
  let pool = validators.filter((v) => v.active_now && !v.is_down);

  // Size filter
  const sorted = [...pool].sort((a, b) => b.blocks_proposed - a.blocks_proposed);
  if (size === "large") pool = sorted.slice(0, 20);
  else if (size === "medium") pool = sorted.slice(20, 60);
  else if (size === "small") pool = sorted.slice(60);

  // Beginners always get 0-alert validators
  if (experience === "beginner") {
    pool = pool.filter((v) => v.alert_level === 0 && v.vdp_flagged_weeks === 0);
  }

  // Score based on priority
  const scored = pool.map((v) => {
    let score = v.uptime_percentage;
    if (priority === "performance") {
      score = v.uptime_percentage * 0.7 + v.current_epoch_success_rate * 0.3;
    } else if (priority === "commission") {
      // No commission data from watchtower, fall back to uptime + clean record
      score = v.uptime_percentage - v.vdp_flagged_weeks * 3;
    } else if (priority === "reputation") {
      score = v.uptime_percentage - v.vdp_flagged_weeks * 5 - v.alert_level * 10;
    } else if (priority === "decentralization") {
      // Prefer mid-ranked validators (not the very top ones)
      const rank = sorted.indexOf(v);
      const diversityBonus = rank > 10 ? 2 : 0;
      score = v.uptime_percentage - v.vdp_flagged_weeks * 2 + diversityBonus;
    }
    return { v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((s) => s.v);
}

export function FindWizard({ validators }: { validators: WatchtowerValidator[] }) {
  const [step, setStep] = useState(0);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [results, setResults] = useState<WatchtowerValidator[] | null>(null);

  function handleContinue() {
    if (step === 0 && priority) setStep(1);
    else if (step === 1 && experience) setStep(2);
    else if (step === 2 && size) {
      const recs = getRecommendations(validators, priority!, experience!, size);
      setResults(recs);
      setStep(3);
    }
  }

  function reset() {
    setStep(0);
    setPriority(null);
    setExperience(null);
    setSize(null);
    setResults(null);
  }

  const canContinue =
    (step === 0 && priority) || (step === 1 && experience) || (step === 2 && size);

  if (step === 3 && results) {
    return <ResultsView results={results} priority={priority!} onReset={reset} />;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wider uppercase">
          <span className="bg-primary size-1.5 animate-pulse rounded-full" />
          Delegator Wizard
        </div>
        <h1 className="font-heading text-foreground text-4xl font-bold sm:text-5xl">
          Find Your Perfect Validator
        </h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-md">
          3 questions. We match you with the top 5 validators from live Monad network data.
        </p>
      </div>

      {/* Wizard card */}
      <div className="border-border/40 bg-card overflow-hidden rounded-3xl border">
        {/* Progress bar */}
        <div className="border-border/40 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i < step ? "bg-primary w-8" : i === step ? "bg-primary w-8" : "bg-muted w-4"
                  }`}
                />
              ))}
            </div>
            <span className="text-muted-foreground text-xs">Step {step + 1} of 3</span>
          </div>
        </div>

        <div className="p-8">
          {step === 0 && (
            <StepView
              title="What matters most to you?"
              hint="Pick your top priority"
              options={PRIORITIES}
              selected={priority}
              onSelect={(id) => setPriority(id as Priority)}
            />
          )}
          {step === 1 && (
            <StepView
              title="How experienced are you with staking?"
              hint="This helps us tailor the recommendations"
              options={EXPERIENCES}
              selected={experience}
              onSelect={(id) => setExperience(id as Experience)}
            />
          )}
          {step === 2 && (
            <StepView
              title="Which validator size do you prefer?"
              hint="Size = position in the network by blocks produced"
              options={SIZES}
              selected={size}
              onSelect={(id) => setSize(id as Size)}
            />
          )}
        </div>

        <div className="border-border/40 flex items-center justify-between border-t px-8 py-4">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              ← Back
            </button>
          ) : (
            <span className="text-muted-foreground text-sm">Takes about 30 seconds</span>
          )}
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center rounded-full px-6 text-sm font-semibold transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {step === 2 ? "Find My Validators →" : "Continue →"}
          </button>
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

function StepView({
  title,
  hint,
  options,
  selected,
  onSelect,
}: {
  title: string;
  hint: string;
  options: { id: string; label: string; desc: string; icon: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <h2 className="font-heading text-foreground mb-1 text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground mb-6 text-sm">{hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onSelect(opt.id)}
              className={`group flex items-start gap-4 rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-primary/10 shadow-md"
                  : "border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-xl transition-colors ${
                  isSelected ? "bg-primary/20" : "bg-primary/10"
                }`}
              >
                {opt.icon}
              </div>
              <div>
                <p className={`font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                  {opt.label}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{opt.desc}</p>
              </div>
              {isSelected && (
                <div className="ml-auto flex-shrink-0">
                  <div className="bg-primary flex size-5 items-center justify-center rounded-full">
                    <svg
                      className="size-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function ResultsView({
  results,
  priority,
  onReset,
}: {
  results: WatchtowerValidator[];
  priority: Priority;
  onReset: () => void;
}) {
  const priorityLabels: Record<Priority, string> = {
    decentralization: "Decentralization",
    performance: "High Performance",
    commission: "Low Commission",
    reputation: "Proven Teams",
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8 text-center">
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wider uppercase">
          <span className="bg-primary size-1.5 rounded-full" />
          Your Matches
        </div>
        <h2 className="font-heading text-foreground text-3xl font-bold">
          Top {results.length} Validators for You
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Optimized for{" "}
          <span className="text-foreground font-medium">{priorityLabels[priority]}</span> · Live
          Monad data
        </p>
      </div>

      {results.length === 0 ? (
        <div className="border-border/40 bg-card rounded-2xl border p-8 text-center">
          <p className="text-muted-foreground">
            No validators matched your filters. Try different preferences.
          </p>
          <button onClick={onReset} className="text-primary mt-4 text-sm hover:underline">
            Start over
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((v, i) => (
            <div
              key={v.node_id}
              className="border-border/40 bg-card flex items-center gap-4 rounded-2xl border p-4"
            >
              <div className="text-muted-foreground bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                {i + 1}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.logo}
                alt={v.name}
                className="size-10 shrink-0 rounded-lg bg-white/5 object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className="text-foreground font-semibold">{v.name}</p>
                <p className="text-muted-foreground text-xs">
                  {v.uptime_percentage.toFixed(1)}% uptime · {v.vdp_flagged_weeks} VDP flags
                  {v.alert_level === 0 ? " · ✅ Clear" : " · ⚠️ Alert"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {v.uptime_percentage === 100 && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    💎 Perfect
                  </span>
                )}
                {v.vdp_flagged_weeks === 0 && v.vdp_weeks_analyzed > 0 && (
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                    🛡️ Clean
                  </span>
                )}
              </div>
              <a
                href="https://monad.xyz/stake"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary text-primary-foreground shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
              >
                Stake ↗
              </a>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-4">
        <Link
          href="/validators"
          className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center rounded-full px-6 text-sm font-semibold transition-all hover:opacity-90"
        >
          See All 200 Validators →
        </Link>
        <button
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          Start over with different preferences
        </button>
      </div>
    </div>
  );
}
