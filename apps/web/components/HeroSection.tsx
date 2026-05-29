"use client";

import { useState, useEffect, useCallback } from "react";
import Typewriter from "./Typewriter";

const EYEBROW = "MONAD VALIDATOR INTELLIGENCE";
const HEADLINE = "THE OPEN EYE\nON MONAD";
const SUBHEAD =
  "PurpleIris reads on-chain data so you don’t have to.\nEvery number cited. Every claim classified.";

export default function HeroSection() {
  const [phase, setPhase] = useState(0); // 0=eyebrow 1=headline 2=subhead 3=done
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches) setPhase(3);
  }, []);

  const onEyebrowDone = useCallback(() => setPhase(1), []);
  const onHeadlineDone = useCallback(() => setPhase(2), []);
  const onSubheadDone = useCallback(() => setPhase(3), []);

  const statVisible = reduced || phase >= 3;

  return (
    <section
      style={{
        position: "relative",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        paddingTop: "56px",
        paddingLeft: "24px",
        paddingRight: "24px",
      }}
    >
      {/* Left-to-right gradient for hero text readability */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(to right, rgba(7,6,26,0.75) 35%, rgba(7,6,26,0.2) 65%, rgba(7,6,26,0) 100%)",
        }}
      />

      {/* Text content — left half */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: "520px", width: "100%" }}>
        {/* Eyebrow */}
        <p
          className="text-xs tracking-[0.3em] uppercase"
          style={{
            color: "var(--accent)",
            marginBottom: "16px",
            fontWeight: 500,
            minHeight: "1em",
          }}
        >
          {reduced ? (
            EYEBROW
          ) : (
            <Typewriter text={EYEBROW} speed={30} active={phase >= 0} onComplete={onEyebrowDone} />
          )}
        </p>

        {/* Headline */}
        <h1
          className="font-bold uppercase"
          style={{
            color: "var(--text)",
            fontSize: "clamp(2rem, 6vw, 4rem)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            marginBottom: "20px",
            minHeight: "2.2em",
          }}
        >
          {reduced ? (
            <>
              THE OPEN EYE
              <br />
              ON MONAD
            </>
          ) : (
            <Typewriter
              text={HEADLINE}
              speed={60}
              active={phase >= 1}
              onComplete={onHeadlineDone}
            />
          )}
        </h1>

        {/* Subhead */}
        <p
          className="text-base leading-relaxed"
          style={{ color: "var(--text-dim)", marginBottom: "0", minHeight: "3em" }}
        >
          {reduced ? (
            <>
              PurpleIris reads on-chain data so you don&apos;t have to.
              <br />
              Every number cited. Every claim classified.
            </>
          ) : (
            <Typewriter text={SUBHEAD} speed={25} active={phase >= 2} onComplete={onSubheadDone} />
          )}
        </p>

        {/* Stat strip — fades in after typing completes */}
        <div
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs tracking-wider uppercase"
          style={{
            borderTop: "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
            borderBottom: "1px solid color-mix(in srgb, var(--border) 40%, transparent)",
            padding: "12px 0",
            marginTop: "32px",
            color: "var(--text-dim)",
            opacity: statVisible ? 1 : 0,
            transition: "opacity 0.6s ease",
          }}
        >
          <span>3 MODES</span>
          <span>·</span>
          <span>200 VALIDATORS</span>
          <span>·</span>
          <span>MAINNET</span>
        </div>
      </div>
    </section>
  );
}
