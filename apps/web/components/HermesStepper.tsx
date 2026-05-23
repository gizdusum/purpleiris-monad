"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, useScroll, useTransform, useInView, useReducedMotion } from "framer-motion";

/* ── Glitch ─────────────────────────────────────────────────────── */
const GLITCH_POOL = "╔═╗╚╝║▓░▒▀▄█▌▐┌┐└┘├┤┬┴┼";
function randomGlitch(len = 6): string {
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

/* ── Types ──────────────────────────────────────────────────────── */
type Badge = { label: string; kind: "live" | "soon" };
type StepDef = {
  num: string;
  name: string;
  color: string;
  /** Actual rgba channel string — e.g. "196,181,255" — for animated box-shadow */
  glowRgb: string;
  slogan: string;
  badge?: Badge;
  bullets: string[];
  isRoadmap?: boolean;
};

const STEPS: StepDef[] = [
  {
    num: "01",
    name: "DELEGATOR",
    color: "var(--cat-casual)",
    glowRgb: "196,181,255",
    slogan: "Pick your validator like a pro — just by asking.",
    badge: { label: "LIVE", kind: "live" },
    bullets: [
      "Find validators in plain language — no block explorer, ever",
      "Compare any two side by side — reliability, stake, performance",
      "Reliability scores at a glance — who actually stays online",
      "Forecast your staking yield — before you delegate",
    ],
  },
  {
    num: "02",
    name: "OPERATOR",
    color: "var(--cat-operator)",
    glowRgb: "124,92,255",
    slogan: "Your node's full story, the instant you ask.",
    badge: { label: "LIVE", kind: "live" },
    bullets: [
      "Staking rewards, live — pending commission + 7-day earnings + monthly estimate",
      "Execution revenue — every MON in transaction fees you've earned",
      "Missed a block? Know instantly — anomaly & downtime checks",
      "Next round assignment — when you're up to propose",
      "Full health diagnostics — epoch history, streaks, jail status",
      "Straight from the staking precompile — raw on-chain truth",
    ],
  },
  {
    num: "03",
    name: "STAKE SIM",
    color: "var(--cat-forecast)",
    glowRgb: "74,58,160",
    slogan: "See your rewards before you stake a single token.",
    badge: { label: "COMING SOON", kind: "soon" },
    bullets: [
      "Model returns across stake sizes & commission rates",
      "Scenario forecasting — what-if, before you commit",
    ],
  },
  {
    num: "04",
    name: "WHAT'S NEXT",
    color: "var(--accent)",
    glowRgb: "124,92,255",
    slogan: "Hermes is just the first mind.",
    bullets: [],
    isRoadmap: true,
  },
];

/* ── z-index: active card wins, next card second, past cards low ── */
function getZIndex(index: number, active: number, total: number): number {
  if (index === active) return total + 2;
  if (index > active) return Math.max(1, total - (index - active) + 1);
  return Math.max(1, active - index);
}

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
        fontSize: "0.6rem",
        letterSpacing: "0.18em",
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

/* ── Roadmap (step 04) ──────────────────────────────────────────── */
function RoadmapCards({ reduced }: { reduced: boolean }) {
  const [glitches, setGlitches] = useState<string[]>(() => ROADMAP.map(() => randomGlitch()));

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setGlitches(ROADMAP.map(() => randomGlitch())), 120);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {ROADMAP.map((item, i) => (
        <motion.div
          key={item.codename}
          initial={reduced ? false : { opacity: 0, y: 14 }}
          whileInView={reduced ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.09, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderRadius: "6px",
            border: "1px solid rgba(124,92,255,0.18)",
            background:
              "linear-gradient(135deg, rgba(124,92,255,0.1) 0%, rgba(75,40,170,0.04) 100%)",
            backdropFilter: "blur(10px)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Left accent bar */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "2px",
              background: "linear-gradient(180deg, var(--accent) 0%, transparent 100%)",
              opacity: 0.55,
            }}
          />
          {/* Version + codename */}
          <div style={{ paddingLeft: "4px" }}>
            <span
              style={{
                display: "block",
                color: "var(--accent)",
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.18em",
                marginBottom: "3px",
              }}
            >
              {item.version}
            </span>
            <span
              style={{
                display: "block",
                color: "var(--text)",
                fontFamily: "var(--font-mono), monospace",
                fontSize: "1.05rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {item.codename}
            </span>
          </div>
          {/* Glitch + status */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "4px",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.6rem",
                color: "rgba(124,92,255,0.45)",
                textShadow: "-1px -1px 0 rgba(255,0,0,0.14), 1px 1px 0 rgba(0,255,255,0.14)",
              }}
            >
              {glitches[i]}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.55rem",
                letterSpacing: "0.16em",
                color: "var(--text-mute)",
                textTransform: "uppercase",
              }}
            >
              INCOMING
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ── Step section: scroll zone + sticky card ────────────────────── */
function StepSection({
  step,
  index,
  total,
  activeStep,
  onInView,
  reduced,
}: {
  step: StepDef;
  index: number;
  total: number;
  activeStep: number;
  onInView: (i: number) => void;
  reduced: boolean;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);

  /* Active step tracking */
  const inView = useInView(sectionRef, { margin: "-30% 0px -30% 0px" });
  useEffect(() => {
    if (inView) onInView(index);
  }, [inView, index, onInView]);

  /* Scroll-linked depth transforms */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.9", "end 0.1"],
  });
  const cardOpacity = useTransform(scrollYProgress, [0, 0.12, 0.76, 1], [0.5, 1, 1, 0.58]);
  const cardScale = useTransform(scrollYProgress, [0, 0.12, 0.76, 1], [0.95, 1, 1, 0.97]);
  const cardY = useTransform(scrollYProgress, [0, 0.12], [20, 0]);

  const isActive = index === activeStep;
  const zIndex = getZIndex(index, activeStep, total);

  /* Box-shadow strings — same # of layers for smooth interpolation */
  const shadowActive = `0 0 0 1px rgba(${step.glowRgb},0.28), 0 8px 48px rgba(${step.glowRgb},0.14), 0 24px 64px rgba(7,6,26,0.65)`;
  const shadowIdle = `0 0 0 1px rgba(42,31,90,0.9), 0 4px 24px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.06)`;

  return (
    /* Scroll zone — min-height on desktop gives the card time to "stick" */
    <div ref={sectionRef} className="relative pb-10 md:min-h-[72vh] md:pb-0">
      {/* Mobile label (desktop has the left indicator) */}
      <div className="mb-4 flex items-center gap-3 md:hidden">
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

      {/* Card: sticky on desktop, flow on mobile */}
      <motion.div
        className="md:sticky"
        animate={reduced ? {} : { boxShadow: isActive ? shadowActive : shadowIdle }}
        transition={{ boxShadow: { duration: 0.38, ease: "easeInOut" } }}
        style={{
          top: "100px",
          zIndex,
          borderRadius: "8px",
          background: "var(--bg-elev)",
          borderTop: `3px solid ${step.color}`,
          padding: "28px",
          ...(reduced ? {} : { opacity: cardOpacity, scale: cardScale, y: cardY }),
        }}
      >
        {/* Category row (desktop; mobile has the label above) */}
        <div className="hidden items-center gap-3 md:flex" style={{ marginBottom: "20px" }}>
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: step.color,
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {step.num} — {step.name}
          </span>
          {step.badge && <BadgePill badge={step.badge} color={step.color} />}
        </div>

        {/* Mobile: divider after mobile label is above the card outer, so just show divider */}
        <div
          className="hidden md:block"
          style={{ borderTop: "1px solid var(--border)", marginBottom: "20px" }}
        />
        <div
          className="md:hidden"
          style={{ borderTop: "1px solid var(--border)", marginBottom: "20px" }}
        />

        {/* Slogan */}
        <p
          style={{
            color: "var(--text)",
            fontSize: "clamp(1.1rem, 2.5vw, 1.4rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.3,
            margin: "0 0 24px",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {step.slogan}
        </p>

        {/* Bullet list */}
        {step.bullets.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "11px",
            }}
          >
            {step.bullets.map((b) => (
              <li
                key={b}
                style={{
                  color: "var(--text-dim)",
                  fontSize: "0.875rem",
                  lineHeight: 1.5,
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
                    opacity: 0.8,
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

        {/* Roadmap (step 04 only) */}
        {step.isRoadmap && <RoadmapCards reduced={reduced} />}
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
          fontSize: "0.65rem",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          marginBottom: "48px",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        WHAT HERMES DOES
      </p>

      {/* Two-col: sticky left indicator + scrolling right cards */}
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] md:gap-16">
        {/* LEFT: step numbers — sticky while right scrolls */}
        <nav
          aria-label="Steps"
          className="hidden flex-col md:flex"
          style={{
            position: "sticky",
            top: "100px",
            alignSelf: "start",
            gap: "28px",
          }}
        >
          {STEPS.map((step, i) => {
            const active = i === activeStep;
            return (
              <div
                key={step.num}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  opacity: active ? 1 : 0.25,
                  transition: "opacity 300ms ease",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "1.6rem",
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                    color: active ? step.color : "var(--text-mute)",
                    transition: "color 300ms ease",
                  }}
                >
                  {step.num}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "0.6rem",
                    fontWeight: 600,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: active ? step.color : "var(--text-mute)",
                    transition: "color 300ms ease",
                  }}
                >
                  {step.name}
                </span>
              </div>
            );
          })}
        </nav>

        {/* RIGHT: step sections (each has its own scroll zone + sticky card) */}
        <div>
          {STEPS.map((step, i) => (
            <StepSection
              key={step.num}
              step={step}
              index={i}
              total={STEPS.length}
              activeStep={activeStep}
              onInView={handleInView}
              reduced={reduced}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
