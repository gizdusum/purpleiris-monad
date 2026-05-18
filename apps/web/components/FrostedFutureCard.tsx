"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  version: string;
  codename: string;
}

const GLITCH_CHARS = "▓░▒█▌▐│┤┘┴├─┌┐└┼╬╫╪╨╞╟╧╤╥╙╘╒╓╫┘┌█▄▌▐▀";
const GLITCH_LEN = 50;

function randomGlitch(): string {
  return Array.from(
    { length: GLITCH_LEN },
    () => GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)] ?? "▓"
  ).join("");
}

export function FrostedFutureCard({ version, codename }: Props) {
  const [glitch, setGlitch] = useState(() => randomGlitch());
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const prefersReduced = useRef(false);

  const startGlitch = useCallback(() => {
    clearInterval(intervalRef.current);
    if (prefersReduced.current) return;
    intervalRef.current = setInterval(() => setGlitch(randomGlitch()), 100);
  }, []);

  const stopGlitch = useCallback(() => clearInterval(intervalRef.current), []);

  useEffect(() => {
    prefersReduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!prefersReduced.current) {
      startGlitch();
    }
    return stopGlitch;
  }, [startGlitch, stopGlitch]);

  return (
    <div
      className="frosted-future-card"
      onMouseEnter={stopGlitch}
      onMouseLeave={startGlitch}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 28px",
        borderRadius: "8px",
        border: "1px solid rgba(124,92,255,0.2)",
        background: "linear-gradient(135deg, rgba(124,92,255,0.12), rgba(75,40,170,0.08))",
        backdropFilter: "blur(12px) saturate(140%)",
        WebkitBackdropFilter: "blur(12px) saturate(140%)",
        height: "80px",
      }}
    >
      <div>
        <p
          className="text-xs tracking-[0.3em] uppercase"
          style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: "4px" }}
        >
          {version}
        </p>
        <p
          className="font-bold uppercase"
          style={{
            color: "var(--text)",
            fontSize: "1.5rem",
            letterSpacing: "-0.02em",
            fontFamily: "var(--font-mono)",
            lineHeight: 1,
          }}
        >
          {codename}
        </p>
      </div>

      <span
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "0.7rem",
          color: "rgba(124,92,255,0.5)",
          letterSpacing: "0.05em",
          maxWidth: "260px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textShadow: "-1px -1px 0 rgba(255,0,0,0.25), 1px 1px 0 rgba(0,255,255,0.25)",
        }}
      >
        {glitch}
      </span>
    </div>
  );
}
