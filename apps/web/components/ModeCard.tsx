"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { StatusMetrics } from "@/app/api/status-metrics/route";

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
type PlanetNode = {
  x: number;
  y: number;
  z: number;
  col: [number, number, number];
  pulse: number;
};
type PlanetPair = {
  a: number;
  b: number;
  col: [number, number, number];
  phase: number;
  speed: number;
};

export default function ModeCard({ card }: { card: CardDef }) {
  const { category, catColor, name, vizType, liveKind, specs, copy, cta, href, disabled } = card;

  // Tilt — direct DOM via CSS custom props, zero React re-renders on mousemove
  const cardRef = useRef<HTMLDivElement>(null);

  // Telemetry — real values from /api/status-metrics. Placeholder text until the
  // first response, and a plain "unavailable" when a source cannot be reached.
  const [tickLine, setTickLine] = useState(
    vizType === "mesh"
      ? "net · reading validator index…"
      : vizType === "osc"
        ? "chain · reading head…"
        : "calibrating projection engine"
  );
  const [vizRead, setVizRead] = useState(
    vizType === "mesh" ? "…" : vizType === "osc" ? "…" : "locked"
  );

  useEffect(() => {
    if (vizType === "forecast") return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/status-metrics");
        if (!res.ok) throw new Error(String(res.status));
        const m = (await res.json()) as StatusMetrics;
        if (cancelled) return;

        if (vizType === "mesh") {
          if (m.sources.database === "ok") {
            setTickLine(`net · ${m.activeValidators} validators in index`);
            setVizRead(m.index.stale ? "index stale" : "synced");
          } else {
            setTickLine("net · validator index unavailable");
            setVizRead("offline");
          }
        } else {
          if (m.sources.rpc === "ok") {
            setTickLine(
              `chain · block ${(m.chainHead / 1e6).toFixed(2)}M · epoch ${m.epoch.toLocaleString("en-US")}`
            );
            setVizRead("● live");
          } else {
            setTickLine("chain · rpc unavailable");
            setVizRead("offline");
          }
        }
      } catch {
        if (cancelled) return;
        setTickLine(vizType === "mesh" ? "net · status unavailable" : "chain · status unavailable");
        setVizRead("offline");
      }
    }

    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [vizType]);

  // Canvas animation — rAF loop with cleanup; skipped if prefers-reduced-motion
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const meshRef = useRef<MeshNode[]>([]);
  const oscPhaseRef = useRef(0); // planet rotation angle for osc viz
  const fcTRef = useRef(0);
  const planetNodesRef = useRef<PlanetNode[]>([]);
  const planetPairsRef = useRef<PlanetPair[]>([]);

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
      if (vizType === "osc") initPlanet();
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

    function initPlanet() {
      const ACC_RGB: [number, number, number] = [124, 92, 255];
      const CY_RGB: [number, number, number] = [92, 224, 168];
      const ACC2_RGB: [number, number, number] = [155, 128, 255];
      const N = 16;
      planetNodesRef.current = Array.from({ length: N }, (_, i) => {
        const y = 1 - (i / (N - 1)) * 2;
        const radius = Math.sqrt(1 - y * y);
        const theta = Math.PI * (3 - Math.sqrt(5)) * i;
        return {
          x: Math.cos(theta) * radius,
          y,
          z: Math.sin(theta) * radius,
          col: i % 3 === 0 ? CY_RGB : ACC2_RGB,
          pulse: Math.random() * 6.28,
        };
      });
      const pairs: PlanetPair[] = [];
      for (let k = 0; k < 8; k++) {
        let a = (Math.random() * N) | 0;
        let b = (Math.random() * N) | 0;
        let tries = 0;
        while (b === a && tries++ < 5) b = (Math.random() * N) | 0;
        if (a !== b)
          pairs.push({
            a,
            b,
            col: Math.random() < 0.5 ? ACC_RGB : CY_RGB,
            phase: Math.random(),
            speed: 0.004 + Math.random() * 0.006,
          });
      }
      planetPairsRef.current = pairs;
      oscPhaseRef.current = 0;
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const rotateY = (p: { x: number; y: number; z: number }, ang: number) => {
      const c = Math.cos(ang),
        s = Math.sin(ang);
      return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
    };
    const rotateX = (p: { x: number; y: number; z: number }, ang: number) => {
      const c = Math.cos(ang),
        s = Math.sin(ang);
      return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
    };

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
        // Rotating 3D half-planet — center pushed below box, upper cap fills frame
        oscPhaseRef.current += 0.0042;
        const rot = oscPhaseRef.current;
        ctx.clearRect(0, 0, W, H);
        const cx = W * 0.5;
        const R = W * 0.62;
        const cy = H * 0.96;
        const tilt = -0.36;

        // atmosphere glow (upper cap)
        const atm = ctx.createRadialGradient(cx, cy, R * 0.75, cx, cy, R * 1.25);
        atm.addColorStop(0, "rgba(124,92,255,0.12)");
        atm.addColorStop(0.6, "rgba(124,92,255,0.05)");
        atm.addColorStop(1, "rgba(124,92,255,0)");
        ctx.fillStyle = atm;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.25, 0, 6.28);
        ctx.fill();

        // sphere body
        const body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.5, R * 0.1, cx, cy, R);
        body.addColorStop(0, "rgba(34,24,78,0.6)");
        body.addColorStop(1, "rgba(8,6,24,0.9)");
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, 6.28);
        ctx.fill();
        ctx.strokeStyle = "rgba(124,92,255,0.32)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, 6.28);
        ctx.stroke();

        // wireframe meridians
        ctx.lineWidth = 0.5;
        for (let m = 0; m < 8; m++) {
          const lon = (m / 8) * Math.PI * 2;
          ctx.beginPath();
          let started = false;
          for (let t = -Math.PI / 2; t <= Math.PI / 2; t += 0.13) {
            let p = {
              x: Math.cos(t) * Math.cos(lon),
              y: Math.sin(t),
              z: Math.cos(t) * Math.sin(lon),
            };
            p = rotateY(p, rot);
            p = rotateX(p, tilt);
            const sx = cx + p.x * R,
              sy = cy + p.y * R;
            if (p.z >= -0.05) {
              if (!started) {
                ctx.moveTo(sx, sy);
                started = true;
              } else ctx.lineTo(sx, sy);
            } else started = false;
          }
          ctx.strokeStyle = "rgba(124,92,255,0.10)";
          ctx.stroke();
        }

        // wireframe parallels
        for (let pa = 1; pa <= 4; pa++) {
          const lat = (pa / 5) * (Math.PI / 2);
          for (const sgn of [1, -1]) {
            ctx.beginPath();
            let started = false;
            for (let lon = 0; lon <= Math.PI * 2; lon += 0.13) {
              let p = {
                x: Math.cos(sgn * lat) * Math.cos(lon),
                y: Math.sin(sgn * lat),
                z: Math.cos(sgn * lat) * Math.sin(lon),
              };
              p = rotateY(p, rot);
              p = rotateX(p, tilt);
              const sx = cx + p.x * R,
                sy = cy + p.y * R;
              if (p.z >= -0.05) {
                if (!started) {
                  ctx.moveTo(sx, sy);
                  started = true;
                } else ctx.lineTo(sx, sy);
              } else started = false;
            }
            ctx.strokeStyle = "rgba(124,92,255,0.07)";
            ctx.stroke();
          }
        }

        // beams: great-circle slerp arcs between node pairs
        const pnodes = planetNodesRef.current;
        planetPairsRef.current.forEach((pr) => {
          pr.phase += pr.speed;
          if (pr.phase > 1.35) pr.phase -= 1.35;
          const A = pnodes[pr.a]!,
            B = pnodes[pr.b]!;
          const steps = 28;
          const head = Math.min(1, pr.phase);
          const fade = pr.phase > 1 ? Math.max(0, 1 - (pr.phase - 1) / 0.35) : 1;
          const [cr, cg, cb] = pr.col;
          let prev: { sx: number; sy: number } | null = null;
          ctx!.lineWidth = 1.5;
          for (let i = 0; i <= steps * head; i++) {
            const u = i / steps;
            const dot = A.x * B.x + A.y * B.y + A.z * B.z;
            const om = Math.acos(Math.max(-1, Math.min(1, dot)));
            let px: number, py: number, pz: number;
            if (om < 1e-3) {
              px = A.x;
              py = A.y;
              pz = A.z;
            } else {
              const s1 = Math.sin((1 - u) * om) / Math.sin(om);
              const s2 = Math.sin(u * om) / Math.sin(om);
              px = A.x * s1 + B.x * s2;
              py = A.y * s1 + B.y * s2;
              pz = A.z * s1 + B.z * s2;
            }
            const lift = 1 + Math.sin(u * Math.PI) * 0.09;
            let p = { x: px * lift, y: py * lift, z: pz * lift };
            p = rotateY(p, rot);
            p = rotateX(p, tilt);
            const sx = cx + p.x * R,
              sy = cy + p.y * R;
            const front = p.z >= -0.1;
            if (prev) {
              const alpha = (front ? 0.95 : 0.22) * fade;
              ctx!.strokeStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`;
              ctx!.shadowColor = `rgb(${cr},${cg},${cb})`;
              ctx!.shadowBlur = front ? 8 : 0;
              ctx!.beginPath();
              ctx!.moveTo(prev.sx, prev.sy);
              ctx!.lineTo(sx, sy);
              ctx!.stroke();
            }
            prev = { sx, sy };
          }
          ctx!.shadowBlur = 0;
          // leading dot at beam head
          if (head < 1) {
            const u = head;
            const dot = A.x * B.x + A.y * B.y + A.z * B.z;
            const om = Math.acos(Math.max(-1, Math.min(1, dot)));
            let px: number, py: number, pz: number;
            if (om < 1e-3) {
              px = A.x;
              py = A.y;
              pz = A.z;
            } else {
              const s1 = Math.sin((1 - u) * om) / Math.sin(om);
              const s2 = Math.sin(u * om) / Math.sin(om);
              px = A.x * s1 + B.x * s2;
              py = A.y * s1 + B.y * s2;
              pz = A.z * s1 + B.z * s2;
            }
            const lift = 1 + Math.sin(u * Math.PI) * 0.09;
            let p = { x: px * lift, y: py * lift, z: pz * lift };
            p = rotateY(p, rot);
            p = rotateX(p, tilt);
            if (p.z >= -0.1) {
              ctx!.beginPath();
              ctx!.arc(cx + p.x * R, cy + p.y * R, 2, 0, 6.28);
              ctx!.fillStyle = `rgb(${cr},${cg},${cb})`;
              ctx!.shadowColor = `rgb(${cr},${cg},${cb})`;
              ctx!.shadowBlur = 8;
              ctx!.fill();
              ctx!.shadowBlur = 0;
            }
          }
        });

        // nodes — sorted back-to-front for depth
        pnodes
          .map((n) => {
            let p = rotateY(n, rot);
            p = rotateX(p, tilt);
            return { sx: cx + p.x * R, sy: cy + p.y * R, z: p.z, n };
          })
          .sort((a, b) => a.z - b.z)
          .forEach((p) => {
            p.n.pulse += 0.05;
            const front = p.z >= -0.05;
            const [cr, cg, cbv] = p.n.col;
            const pr = (front ? 2.2 : 1.2) + Math.sin(p.n.pulse) * 0.5;
            const alpha = front ? 0.95 : 0.28;
            ctx!.beginPath();
            ctx!.arc(p.sx, p.sy, pr, 0, 6.28);
            ctx!.fillStyle = `rgba(${cr},${cg},${cbv},${alpha})`;
            ctx!.shadowColor = `rgb(${cr},${cg},${cbv})`;
            ctx!.shadowBlur = front ? 10 : 0;
            ctx!.fill();
            ctx!.shadowBlur = 0;
          });
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
