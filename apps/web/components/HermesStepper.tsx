"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

const GLITCH_POOL = "╔═╗╚╝║▓░▒▀▄█▌▐┌┐└┘├┤┬┴┼";

function randomGlitch(len = 8): string {
  return Array.from(
    { length: len },
    () => GLITCH_POOL[Math.floor(Math.random() * GLITCH_POOL.length)]
  ).join("");
}

const ROADMAP = [
  { version: "v1.1", codename: "ATHENA" },
  { version: "v1.2", codename: "ARGUS" },
  { version: "v1.3", codename: "MNEMOSYNE" },
  { version: "v2.0", codename: "PYTHIA" },
] as const;

type Badge = { label: string; kind: "live" | "soon" };

type StepDef = {
  num: string;
  name: string;
  color: string;
  tagline: string;
  badge?: Badge;
  bullets: string[];
  isRoadmap?: boolean;
};

const STEPS: StepDef[] = [
  {
    num: "01",
    name: "DELEGATOR",
    color: "var(--cat-casual)",
    tagline: "Find and compare validators in plain language.",
    badge: { label: "Live", kind: "live" },
    bullets: [
      "Conversational validator discovery",
      "Reliability scoring",
      "Side-by-side validator comparison",
      "Stake forecasting for delegators",
    ],
  },
  {
    num: "02",
    name: "OPERATOR",
    color: "var(--cat-operator)",
    tagline: "Diagnostics and earnings for node runners.",
    badge: { label: "Live", kind: "live" },
    bullets: [
      "Validator health & diagnostics",
      "Missed-block and anomaly checks",
      "Round-assignment prediction",
      "Execution (fee) revenue",
      "Staking rewards — live pending commission, 7-day cumulative, monthly estimate, read straight from the staking precompile",
    ],
  },
  {
    num: "03",
    name: "STAKE SIM",
    color: "var(--cat-forecast)",
    tagline: "Forecast rewards before you stake.",
    badge: { label: "Coming soon", kind: "soon" },
    bullets: [
      "Model staking returns under different stake sizes and commission rates",
      "Scenario forecasting across validators",
    ],
  },
  {
    num: "04",
    name: "WHAT'S NEXT",
    color: "var(--accent)",
    tagline: "Hermes is v1.0. The roadmap:",
    bullets: [],
    isRoadmap: true,
  },
];

/* ── Badge pill ─────────────────────────────────────────────────── */
function BadgePill({ badge, color }: { badge: Badge; color: string }) {
  const isLive = badge.kind === "live";
  return (
    <span
      style={{
        display: "inline-block",
        border: `1px solid ${isLive ? color : "var(--text-mute)"}`,
        color: isLive ? color : "var(--text-mute)",
        padding: "2px 8px",
        borderRadius: "3px",
        fontSize: "0.65rem",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        fontFamily: "var(--font-mono), monospace",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    >
      {badge.label}
    </span>
  );
}

/* ── Roadmap list (step 04) ─────────────────────────────────────── */
function RoadmapList({ reduced }: { reduced: boolean }) {
  const [glitches, setGlitches] = useState<string[]>(() => ROADMAP.map(() => randomGlitch()));

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setGlitches(ROADMAP.map(() => randomGlitch()));
    }, 110);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {ROADMAP.map((item, i) => (
        <div
          key={item.codename}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderRadius: "6px",
            border: "1px solid rgba(124,92,255,0.2)",
            background: "linear-gradient(135deg, rgba(124,92,255,0.08), rgba(75,40,170,0.04))",
            backdropFilter: "blur(8px)",
          }}
        >
          <div>
            <span
              style={{
                display: "block",
                color: "var(--accent)",
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.65rem",
                letterSpacing: "0.15em",
              }}
            >
              {item.version}
            </span>
            <span
              style={{
                display: "block",
                color: "var(--text)",
                fontFamily: "var(--font-mono), monospace",
                fontSize: "1.1rem",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {item.codename}
            </span>
          </div>
          <span
            aria-hidden="true"
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.65rem",
              color: "rgba(124,92,255,0.4)",
              textShadow: "-1px -1px 0 rgba(255,0,0,0.2), 1px 1px 0 rgba(0,255,255,0.2)",
            }}
          >
            {glitches[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Individual step block ──────────────────────────────────────── */
function StepBlock({
  step,
  index,
  onInView,
  reduced,
}: {
  step: StepDef;
  index: number;
  onInView: (i: number) => void;
  reduced: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const inView = useInView(trackRef, { margin: "-30% 0px -30% 0px" });

  useEffect(() => {
    if (inView) onInView(index);
  }, [inView, index, onInView]);

  const body = (
    <>
      {/* Mobile-only step label (hidden md+) */}
      <div className="flex items-center gap-3 md:hidden" style={{ marginBottom: "14px" }}>
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: step.color,
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {step.num} — {step.name}
        </span>
        {step.badge && <BadgePill badge={step.badge} color={step.color} />}
      </div>

      {/* Bordered block body */}
      <div style={{ borderLeft: `2px solid ${step.color}`, paddingLeft: "28px" }}>
        {/* Tagline + badge row */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <p
            style={{
              color: "var(--text)",
              fontSize: "1.15rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              lineHeight: 1.35,
              margin: 0,
              textTransform: "uppercase",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {step.tagline}
          </p>
          {step.badge && (
            <span className="hidden md:inline-block">
              <BadgePill badge={step.badge} color={step.color} />
            </span>
          )}
        </div>

        {/* Bullet list */}
        {step.bullets.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {step.bullets.map((b) => (
              <li
                key={b}
                style={{
                  color: "var(--text-dim)",
                  fontSize: "0.875rem",
                  lineHeight: 1.55,
                  paddingLeft: "18px",
                  position: "relative",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "5px",
                    color: step.color,
                    opacity: 0.7,
                    fontSize: "0.5rem",
                  }}
                >
                  ▸
                </span>
                {b}
              </li>
            ))}
          </ul>
        )}

        {/* Roadmap grid (step 04) */}
        {step.isRoadmap && <RoadmapList reduced={reduced} />}
      </div>
    </>
  );

  if (reduced) {
    return <div ref={trackRef}>{body}</div>;
  }

  return (
    <div ref={trackRef}>
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-5%" }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {body}
      </motion.div>
    </div>
  );
}

/* ── Main export ────────────────────────────────────────────────── */
export default function HermesStepper() {
  const [activeStep, setActiveStep] = useState(0);
  const reduced = useReducedMotion() ?? false;
  const handleInView = useCallback((i: number) => setActiveStep(i), []);

  return (
    <section
      style={{
        maxWidth: "1152px",
        margin: "100px auto 0",
        padding: "0 24px 80px",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* Section eyebrow */}
      <p
        style={{
          color: "var(--text-mute)",
          fontSize: "0.7rem",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          marginBottom: "40px",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        WHAT HERMES DOES
      </p>

      {/* Two-column grid: sticky indicator (md+) + scrolling blocks */}
      <div className="grid grid-cols-1 items-start md:grid-cols-[200px_1fr] md:gap-16">
        {/* LEFT: sticky step indicator — desktop only */}
        <nav
          aria-label="Steps"
          className="hidden flex-col md:flex"
          style={{ position: "sticky", top: "100px", gap: "24px" }}
        >
          {STEPS.map((step, i) => {
            const active = i === activeStep;
            return (
              <div
                key={step.num}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  opacity: active ? 1 : 0.3,
                  transition: "opacity 250ms ease",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "0.6rem",
                    letterSpacing: "0.2em",
                    color: active ? step.color : "var(--text-mute)",
                    transition: "color 250ms ease",
                  }}
                >
                  {step.num}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: active ? step.color : "var(--text-mute)",
                    transition: "color 250ms ease",
                  }}
                >
                  {step.name}
                </span>
              </div>
            );
          })}
        </nav>

        {/* RIGHT: step content blocks */}
        <div style={{ display: "flex", flexDirection: "column", gap: "72px" }}>
          {STEPS.map((step, i) => (
            <StepBlock
              key={step.num}
              step={step}
              index={i}
              onInView={handleInView}
              reduced={reduced}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
