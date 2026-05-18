"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

export default function HeroSection() {
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove);

    function tick() {
      const tx = mouseRef.current.x * 8;
      const ty = mouseRef.current.y * 4;
      currentRef.current.x += (tx - currentRef.current.x) * 0.06;
      currentRef.current.y += (ty - currentRef.current.y) * 0.06;
      if (imgWrapRef.current) {
        imgWrapRef.current.style.transform = `translate(${currentRef.current.x}px, ${currentRef.current.y}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

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
      {/* Layer 0 — hero image with Ken Burns */}
      <div
        ref={imgWrapRef}
        style={{
          position: "absolute",
          inset: "-12px",
          willChange: "transform",
        }}
      >
        <Image
          src="/hero/iris.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-image-zoom"
          style={{ objectFit: "cover", objectPosition: "center right" }}
          aria-hidden="true"
        />
      </div>

      {/* Layer 1 — dual gradient overlays */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to right, rgba(7,6,26,0.92) 40%, rgba(7,6,26,0.55) 65%, rgba(7,6,26,0.15) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(7,6,26,0.4) 0%, transparent 20%, transparent 80%, rgba(7,6,26,0.6) 100%)",
        }}
      />

      {/* Layer 2 — SVG grain */}
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.06,
          pointerEvents: "none",
        }}
      >
        <filter id="iris-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#iris-grain)" />
      </svg>

      {/* Layer 3 — text content, left half */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: "520px", width: "100%" }}>
        {/* Eyebrow */}
        <p
          className="text-xs tracking-[0.3em] uppercase"
          style={{ color: "var(--accent)", marginBottom: "16px", fontWeight: 500 }}
        >
          MONAD VALIDATOR INTELLIGENCE
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
          }}
        >
          THE OPEN EYE
          <br />
          ON MONAD
        </h1>

        {/* Subhead */}
        <p
          className="text-base leading-relaxed"
          style={{ color: "var(--text-dim)", marginBottom: "0" }}
        >
          Iris reads on-chain data so you don&apos;t have to.
          <br />
          Every number cited. Every claim classified.
        </p>

        {/* Stat strip */}
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tracking-wider uppercase"
          style={{
            borderTop: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
            borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
            padding: "12px 0",
            marginTop: "32px",
            color: "var(--text-dim)",
          }}
        >
          <span>3 MODES</span>
          <span>·</span>
          <span>202 VALIDATORS</span>
          <span>·</span>
          <span>MAINNET</span>
          <span>·</span>
          <span>CLAUDE SONNET 4.6</span>
          <span>·</span>
          <span>CLASS 1/2/3</span>
        </div>
      </div>
    </section>
  );
}
