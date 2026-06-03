"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";

export type CardDef = {
  id: string;
  category: string;
  catColor: string;
  name: string;
  vizType: "mesh" | "osc" | "forecast";
  liveKind: "live" | "soon";
  specs: { key: string; value: string }[];
  copy: string;
  cta: string;
  href: string;
  disabled: boolean;
};

const OK = "#5ce0a8";
const WARN = "#e0b15c";
const ACC = "#7c5cff";
const ACC2 = "#9b80ff";

type MeshNode = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  p: number;
  col?: string;
};
type Beam = {
  n0: MeshNode;
  n1: MeshNode;
  cx: number;
  cy: number;
  col: string;
  life: number;
  dur: number;
};

export default function ModeCard({ card }: { card: CardDef }) {
  const { category, catColor, name, vizType, liveKind, specs, copy, cta, href, disabled } = card;

  // Tilt — direct DOM via CSS custom props, zero React re-renders on mousemove
  const cardRef = useRef<HTMLDivElement>(null);

  // Telemetry — stable initial values (no randomness → no hydration mismatch)
  const [tickLine, setTickLine] = useState(
    vizType === "mesh"
      ? "net · 202 validators online"
      : vizType === "osc"
        ? "node · uptime 99.97% · 77.21M blk"
        : "v2.0 · calibrating projection engine"
  );
  const [vizRead, setVizRead] = useState(
    vizType === "mesh" ? "scanning" : vizType === "osc" ? "● rec" : "locked"
  );

  // Telemetry — randomized only after mount (client only)
  useEffect(() => {
    if (vizType === "forecast") return;
    const blkRef = { v: 77211650 };
    const ids: ReturnType<typeof setInterval>[] = [];
    if (vizType === "mesh") {
      const states = ["scanning", "synced", "indexing"] as const;
      ids.push(
        setInterval(() => {
          setTickLine(`net · ${200 + Math.floor(Math.random() * 4)} validators online`);
          setVizRead(states[Math.floor(Math.random() * 3)]!);
        }, 1400)
      );
    }
    if (vizType === "osc") {
      ids.push(
        setInterval(() => {
          setTickLine(
            `node · uptime ${(99.93 + Math.random() * 0.06).toFixed(2)}% · ${(blkRef.v / 1e6).toFixed(2)}M blk`
          );
        }, 1400)
      );
      ids.push(
        setInterval(() => {
          blkRef.v += Math.floor(Math.random() * 6 + 2);
        }, 900)
      );
    }
    return () => ids.forEach(clearInterval);
  }, [vizType]);

  // Canvas animation — rAF loop with cleanup; skipped if prefers-reduced-motion
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const meshRef = useRef<MeshNode[]>([]);
  const beamsRef = useRef<Beam[]>([]);
  const oscPhaseRef = useRef(0); // repurposed as frame counter for osc beam viz
  const fcTRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ctx: CanvasRenderingContext2D | null = null;
    let W = 0,
      H = 0;

    function resize() {
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      W = r.width;
      H = r.height;
      if (vizType === "mesh") initMesh();
      if (vizType === "osc") initBeamNodes();
    }

    function initMesh() {
      meshRef.current = Array.from({ length: 14 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.6 + 1.2,
        p: Math.random() * 6.28,
      }));
    }

    function initBeamNodes() {
      meshRef.current = Array.from({ length: 9 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        r: Math.random() * 1.4 + 1.1,
        p: Math.random() * 6.28,
        col: Math.random() < 0.5 ? ACC : OK,
      }));
      beamsRef.current = [];
      oscPhaseRef.current = 0;
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    function frame(_t: number) {
      if (!ctx) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      if (vizType === "mesh") {
        ctx.clearRect(0, 0, W, H);
        const ns = meshRef.current;
        for (let i = 0; i < ns.length; i++)
          for (let j = i + 1; j < ns.length; j++) {
            const a = ns[i]!,
              b = ns[j]!;
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < 58) {
              ctx.strokeStyle = `rgba(124,92,255,${(0.5 * (1 - d / 58)).toFixed(3)})`;
              ctx.lineWidth = 0.6;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        ns.forEach((n) => {
          n.x += n.vx;
          n.y += n.vy;
          n.p += 0.04;
          if (n.x < 0 || n.x > W) n.vx *= -1;
          if (n.y < 0 || n.y > H) n.vy *= -1;
          const pr = n.r + Math.sin(n.p) * 0.6;
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, pr, 0, 6.28);
          ctx!.fillStyle = ACC2;
          ctx!.shadowColor = ACC;
          ctx!.shadowBlur = 8;
          ctx!.fill();
          ctx!.shadowBlur = 0;
        });
      } else if (vizType === "osc") {
        oscPhaseRef.current++;
        const ft = oscPhaseRef.current;
        ctx.clearRect(0, 0, W, H);
        const ns = meshRef.current;

        // Faint static mesh links between nearby nodes
        for (let i = 0; i < ns.length; i++)
          for (let j = i + 1; j < ns.length; j++) {
            const a = ns[i]!,
              b = ns[j]!;
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < 70) {
              ctx.strokeStyle = `rgba(124,92,255,${(0.12 * (1 - d / 70)).toFixed(3)})`;
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }

        // Move + draw nodes
        ns.forEach((n) => {
          n.x += n.vx;
          n.y += n.vy;
          n.p += 0.05;
          if (n.x < 2 || n.x > W - 2) n.vx *= -1;
          if (n.y < 2 || n.y > H - 2) n.vy *= -1;
          const pr = n.r + Math.sin(n.p) * 0.5;
          const col = n.col ?? ACC2;
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, pr, 0, 6.28);
          ctx!.fillStyle = col;
          ctx!.shadowColor = col;
          ctx!.shadowBlur = 8;
          ctx!.fill();
          ctx!.shadowBlur = 0;
        });

        // Spawn a beam arc every 18 frames
        if (ft % 18 === 0 && ns.length >= 2) {
          let ai = (Math.random() * ns.length) | 0;
          let bi = (Math.random() * ns.length) | 0;
          let tries = 0;
          while (bi === ai && tries++ < 5) bi = (Math.random() * ns.length) | 0;
          if (ai !== bi) {
            const n0 = ns[ai]!,
              n1 = ns[bi]!;
            const dx = n1.x - n0.x,
              dy = n1.y - n0.y,
              d = Math.hypot(dx, dy);
            if (d <= W * 0.7) {
              const mxp = (n0.x + n1.x) / 2,
                myp = (n0.y + n1.y) / 2;
              const nx = -dy / d,
                ny = dx / d;
              const bow = (18 + Math.random() * 26) * (Math.random() < 0.5 ? 1 : -1);
              beamsRef.current.push({
                n0,
                n1,
                cx: mxp + nx * bow,
                cy: myp + ny * bow,
                col: Math.random() < 0.5 ? ACC : OK,
                life: 0,
                dur: 55 + Math.random() * 35,
              });
            }
          }
        }

        // Draw + age beams: animated quadratic bezier draw + leading glow dot + fade
        beamsRef.current.forEach((bm) => {
          bm.life++;
          const prog = Math.min(1, bm.life / (bm.dur * 0.45));
          const fade = bm.life > bm.dur * 0.6 ? 1 - (bm.life - bm.dur * 0.6) / (bm.dur * 0.4) : 1;
          ctx!.strokeStyle = bm.col;
          ctx!.globalAlpha = Math.max(0, fade) * 0.95;
          ctx!.lineWidth = 1.5;
          ctx!.shadowColor = bm.col;
          ctx!.shadowBlur = 8;
          const steps = 20,
            end = Math.floor(steps * prog);
          ctx!.beginPath();
          ctx!.moveTo(bm.n0.x, bm.n0.y);
          for (let i = 1; i <= end; i++) {
            const u = i / steps;
            const x = (1 - u) * (1 - u) * bm.n0.x + 2 * (1 - u) * u * bm.cx + u * u * bm.n1.x;
            const y = (1 - u) * (1 - u) * bm.n0.y + 2 * (1 - u) * u * bm.cy + u * u * bm.n1.y;
            ctx!.lineTo(x, y);
          }
          ctx!.stroke();
          if (end > 0 && end < steps) {
            const u = end / steps;
            const x = (1 - u) * (1 - u) * bm.n0.x + 2 * (1 - u) * u * bm.cx + u * u * bm.n1.x;
            const y = (1 - u) * (1 - u) * bm.n0.y + 2 * (1 - u) * u * bm.cy + u * u * bm.n1.y;
            ctx!.beginPath();
            ctx!.arc(x, y, 2, 0, 6.28);
            ctx!.fillStyle = bm.col;
            ctx!.fill();
          }
          ctx!.shadowBlur = 0;
          ctx!.globalAlpha = 1;
        });
        beamsRef.current = beamsRef.current.filter((b) => b.life < b.dur);
      } else {
        fcTRef.current += 0.01;
        const ft = fcTRef.current;
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(124,92,255,0.18)";
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, H * 0.72);
        ctx.lineTo(W, H * 0.72);
        ctx.stroke();
        ctx.setLineDash([]);
        const end = W * (Math.sin(ft) * 0.5 + 0.5);
        ctx.strokeStyle = WARN;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let x = 0; x <= end; x += 2) ctx.lineTo(x, H * 0.72 - Math.pow(x / W, 1.7) * H * 0.55);
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (end > 2) {
          const y = H * 0.72 - Math.pow(end / W, 1.7) * H * 0.55;
          ctx.beginPath();
          ctx.arc(end, y, 2.4, 0, 6.28);
          ctx.fillStyle = WARN;
          ctx.shadowColor = WARN;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [vizType]);

  const liveColor = liveKind === "live" ? OK : WARN;
  const vizLabel =
    vizType === "mesh"
      ? "validator mesh"
      : vizType === "osc"
        ? "node diagnostics"
        : "reward forecast";
  const readColor = vizType === "forecast" ? WARN : ACC2;

  const inner = (
    <div
      ref={cardRef}
      className="mode-card-v2 relative flex h-full flex-col overflow-hidden rounded-md"
      style={{ border: "1px solid var(--border)", padding: "20px 22px 22px" } as CSSProperties}
      onMouseMove={(e) => {
        const el = cardRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--rx", `${((0.5 - py) * 8).toFixed(2)}deg`);
        el.style.setProperty("--ry", `${((px - 0.5) * 8).toFixed(2)}deg`);
        el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
        el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      }}
      onMouseLeave={() => {
        const el = cardRef.current;
        if (!el) return;
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
        el.style.setProperty("--mx", "50%");
        el.style.setProperty("--my", "0%");
      }}
    >
      <div className="mode-card-v2-conduit" aria-hidden="true" />
      <span className="hud-corner tl" aria-hidden="true" />
      <span className="hud-corner tr" aria-hidden="true" />
      <span className="hud-corner bl" aria-hidden="true" />
      <span className="hud-corner br" aria-hidden="true" />

      {/* Header: category + live status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2px",
        }}
      >
        <p
          style={{
            fontSize: "10px",
            letterSpacing: ".28em",
            color: catColor,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {category}
        </p>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "9px",
            letterSpacing: ".16em",
            color: liveColor,
          }}
        >
          <span
            className="live-dot"
            style={{ background: liveColor, boxShadow: `0 0 8px ${liveColor}` }}
          />
          {liveKind === "live" ? "LIVE" : "SOON"}
        </span>
      </div>

      <h2
        style={{
          fontSize: "30px",
          fontWeight: 800,
          letterSpacing: ".005em",
          lineHeight: 1,
          margin: "6px 0 2px",
          color: "var(--text)",
        }}
      >
        {name}
      </h2>

      <div
        style={{
          fontSize: "10.5px",
          color: "var(--text-mute)",
          letterSpacing: ".06em",
          height: "14px",
          marginBottom: "12px",
        }}
      >
        {tickLine}
      </div>

      {/* Live canvas visualization */}
      <div
        style={{
          position: "relative",
          height: "108px",
          margin: "2px 0 16px",
          borderRadius: "6px",
          background: "linear-gradient(180deg, rgba(124,92,255,.05), rgba(124,92,255,.01))",
          border: "1px solid rgba(124,92,255,.10)",
          overflow: "hidden",
        }}
      >
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
        <span
          style={{
            position: "absolute",
            left: "9px",
            bottom: "7px",
            fontSize: "8.5px",
            letterSpacing: ".18em",
            color: "var(--text-mute)",
            textTransform: "uppercase",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          {vizLabel}
        </span>
        <span
          style={{
            position: "absolute",
            right: "9px",
            top: "7px",
            fontSize: "9px",
            letterSpacing: ".08em",
            color: readColor,
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          {vizRead}
        </span>
      </div>

      {/* Spec rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
        {specs.map((s) => (
          <div
            key={s.key}
            style={{
              display: "grid",
              gridTemplateColumns: "78px 1fr",
              fontSize: "12px",
              alignItems: "center",
            }}
          >
            <span
              style={{
                color: "var(--text-mute)",
                letterSpacing: ".1em",
                textTransform: "uppercase",
                fontSize: "10px",
              }}
            >
              {s.key}
            </span>
            <span style={{ color: "var(--text)" }}>{s.value}</span>
          </div>
        ))}
      </div>

      <p
        style={{
          fontSize: "12px",
          lineHeight: 1.65,
          color: "var(--text-dim)",
          marginBottom: "18px",
          minHeight: "40px",
        }}
      >
        {copy}
      </p>

      {/* Enter button with CSS sweep via ::after */}
      <button
        disabled={disabled}
        className="enter-v2 w-full rounded-sm"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          padding: "13px",
          border: disabled
            ? "1px dashed var(--border)"
            : `1px solid ${vizType === "osc" ? "rgba(124,92,255,.55)" : "var(--border)"}`,
          background: disabled
            ? "transparent"
            : vizType === "osc"
              ? "rgba(124,92,255,.13)"
              : "rgba(124,92,255,.05)",
          color: disabled ? "var(--text-mute)" : "var(--text)",
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          fontSize: "11.5px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
        }}
      >
        {disabled ? (
          <span>◇ {cta}</span>
        ) : (
          <>
            <span>{cta}</span>
            <span className="enter-arrow">→</span>
          </>
        )}
      </button>
    </div>
  );

  if (disabled || href === "#") return <div className="flex">{inner}</div>;
  return (
    <Link href={href} className="flex">
      {inner}
    </Link>
  );
}
