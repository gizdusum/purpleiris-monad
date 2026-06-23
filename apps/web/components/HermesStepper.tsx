"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionTemplate,
  useInView,
  useReducedMotion,
} from "framer-motion";

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
];

/* ── Desktop guard ──────────────────────────────────────────────── */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

/* ── z-index: active card wins ──────────────────────────────────── */
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

/* ── Step section ───────────────────────────────────────────────── */
function StepSection({
  step,
  index,
  total,
  activeStep,
  onInView,
  reduced,
  isDesktop,
}: {
  step: StepDef;
  index: number;
  total: number;
  activeStep: number;
  onInView: (i: number) => void;
  reduced: boolean;
  isDesktop: boolean;
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
  const cardOpacity = useTransform(scrollYProgress, [0, 0.18, 0.72, 1], [0.05, 1, 1, 0.05]);
  const cardScale = useTransform(scrollYProgress, [0, 0.18, 0.72, 1], [0.9, 1, 1, 0.9]);
  const cardY = useTransform(scrollYProgress, [0, 0.18], [20, 0]);
  const blurPx = useTransform(scrollYProgress, [0, 0.18, 0.72, 1], [10, 0, 0, 10]);
  const cardFilter = useMotionTemplate`blur(${blurPx}px)`;

  const applyDepth = isDesktop && !reduced;
  const isActive = index === activeStep;
  const zIndex = getZIndex(index, activeStep, total);

  /* Bullet re-animation: increment key when step becomes active */
  const [animKey, setAnimKey] = useState(0);
  const prevActiveRef = useRef(false);
  useEffect(() => {
    if (isActive && !prevActiveRef.current) setAnimKey((k) => k + 1);
    prevActiveRef.current = isActive;
  }, [isActive]);

  const shadowActive = `0 0 0 1px rgba(${step.glowRgb},0.28), 0 8px 48px rgba(${step.glowRgb},0.14), 0 24px 64px rgba(7,6,26,0.65)`;
  const shadowIdle = `0 0 0 1px rgba(42,31,90,0.9), 0 4px 24px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.06)`;

  return (
    <div ref={sectionRef} className="relative pb-10 md:min-h-[72vh] md:pb-0">
      {/* Mobile label */}
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

      {/* Card */}
      <motion.div
        className="md:sticky"
        animate={reduced ? {} : { boxShadow: isActive ? shadowActive : shadowIdle }}
        transition={{ boxShadow: { duration: 0.38, ease: "easeInOut" } }}
        style={{
          top: "100px",
          zIndex,
          borderRadius: "8px",
          overflow: "hidden",
          ...(applyDepth
            ? { opacity: cardOpacity, scale: cardScale, y: cardY, filter: cardFilter }
            : {}),
        }}
      >
        {/* Inner wrapper — positioning context for ghost plate + ghost num */}
        <div style={{ position: "relative", padding: "28px" }}>
          {/* Ghost plate — ambient glow */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              background:
                "radial-gradient(120% 100% at 30% 0%, rgba(124,92,255,.06), transparent 70%), linear-gradient(180deg, rgba(124,92,255,.035), rgba(124,92,255,.012))",
              WebkitMask: "radial-gradient(130% 120% at 50% 40%, #000 55%, transparent 100%)",
              mask: "radial-gradient(130% 120% at 50% 40%, #000 55%, transparent 100%)",
              pointerEvents: "none",
            }}
          />
          {/* Ghost index watermark */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              right: "8px",
              fontSize: "140px",
              fontWeight: 800,
              lineHeight: 1,
              color: "rgba(124,92,255,.045)",
              pointerEvents: "none",
              zIndex: 0,
              letterSpacing: "-.02em",
              userSelect: "none",
            }}
          >
            {step.num}
          </span>

          {/* Card content — above ghost layers */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Category row (desktop) */}
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

            <div
              className="hidden md:block"
              style={{ borderTop: "1px solid var(--border)", marginBottom: "20px" }}
            />
            <div
              className="md:hidden"
              style={{ borderTop: "1px solid var(--border)", marginBottom: "20px" }}
            />

            {/* Slogan — hero gradient sweep */}
            <p
              className="hero-headline-anim"
              style={{
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

            {/* Bullets */}
            {step.bullets.length > 0 && (
              <div
                key={animKey}
                className={`step-bullets${isActive && !reduced ? "step-bullets-active" : ""}`}
              >
                {step.bullets.map((b) => (
                  <div key={b} className="step-bullet">
                    <span className="step-mk">→</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Main export ────────────────────────────────────────────────── */
export default function HermesStepper() {
  const [activeStep, setActiveStep] = useState(0);
  const reduced = useReducedMotion() ?? false;
  const isDesktop = useIsDesktop();
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
        WHAT PURPLEIRIS DOES
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] md:gap-16">
        {/* LEFT: node-circle stepper nav */}
        <nav
          aria-label="Steps"
          className="hidden flex-col md:flex"
          style={{
            position: "sticky",
            top: "100px",
            alignSelf: "start",
            gap: "4px",
          }}
        >
          <div className="step-stepper-line" aria-hidden="true" />
          {STEPS.map((step, i) => {
            const active = i === activeStep;
            return (
              <div
                key={step.num}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "16px",
                  padding: "14px 0",
                  opacity: active ? 1 : 0.4,
                  transition: "opacity 300ms ease",
                }}
              >
                {/* Node circle */}
                <div
                  style={{
                    position: "relative",
                    zIndex: 2,
                    width: "27px",
                    height: "27px",
                    flexShrink: 0,
                    borderRadius: "50%",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    background: active ? "rgba(124,92,255,.08)" : "var(--bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    color: active ? "var(--accent-hover)" : "var(--text-mute)",
                    boxShadow: active
                      ? "0 0 0 4px rgba(124,92,255,.10), 0 0 20px -4px var(--accent)"
                      : "none",
                    transition: "all 300ms ease",
                  }}
                >
                  {step.num}
                  {active && <span className="step-node-ring" aria-hidden="true" />}
                </div>
                {/* Meta */}
                <div style={{ paddingTop: "3px" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      letterSpacing: ".2em",
                      color: active ? "var(--accent)" : "var(--text-mute)",
                      transition: "color 300ms ease",
                    }}
                  >
                    {step.num}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      letterSpacing: ".16em",
                      textTransform: "uppercase",
                      color: active ? "var(--text)" : "var(--text-dim)",
                      transition: "color 300ms ease",
                      marginTop: "2px",
                    }}
                  >
                    {step.name}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* RIGHT: step sections */}
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
              isDesktop={isDesktop}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
