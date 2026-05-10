"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

// 85 validator nodes distributed globally [lat, lng]
const VALIDATORS: [number, number][] = [
  // North America
  [40.71, -74.0],
  [37.77, -122.42],
  [41.88, -87.63],
  [47.61, -122.33],
  [33.75, -84.39],
  [29.76, -95.37],
  [25.77, -80.19],
  [45.5, -73.57],
  [43.65, -79.38],
  [49.25, -123.12],
  [39.95, -75.17],
  [42.36, -71.06],
  [32.78, -96.8],
  [34.05, -118.24],
  [35.23, -97.53],
  [44.98, -93.27],
  [39.74, -104.98],
  [30.27, -97.74],
  [36.17, -86.78],
  [38.9, -77.04],
  // Europe
  [51.51, -0.13],
  [48.86, 2.35],
  [52.52, 13.4],
  [59.91, 10.75],
  [55.68, 12.57],
  [60.17, 24.94],
  [52.23, 21.01],
  [50.11, 8.68],
  [48.21, 16.37],
  [45.46, 9.19],
  [40.42, -3.7],
  [38.72, -9.14],
  [37.98, 23.73],
  [41.01, 28.95],
  [59.33, 18.07],
  [53.35, -6.26],
  [47.38, 8.54],
  [50.85, 4.35],
  [52.37, 4.9],
  [48.15, 17.11],
  [46.95, 7.45],
  [43.3, 5.38],
  [44.44, 26.1],
  [54.69, 25.28],
  [56.95, 24.11],
  // Asia
  [35.69, 139.69],
  [37.57, 126.98],
  [22.28, 114.16],
  [1.29, 103.85],
  [13.75, 100.52],
  [19.08, 72.88],
  [28.63, 77.22],
  [31.23, 121.47],
  [39.91, 116.39],
  [3.14, 101.69],
  [-6.21, 106.85],
  [23.13, 113.26],
  [12.97, 77.59],
  [25.07, 121.56],
  [22.57, 88.36],
  [17.38, 78.49],
  [30.67, 76.78],
  [10.82, 106.63],
  [35.68, 51.39],
  [41.3, 69.24],
  [43.25, 76.95],
  [51.18, 71.45],
  [55.75, 37.62],
  [24.71, 46.67],
  [33.34, 44.4],
  // Oceania
  [-33.87, 151.21],
  [-37.81, 144.96],
  [-36.87, 174.77],
  [-31.95, 115.86],
  [-27.47, 153.02],
  // South America
  [-23.55, -46.63],
  [-34.61, -58.38],
  [4.71, -74.07],
  [-12.05, -77.04],
  [-15.78, -47.93],
  [-33.46, -70.65],
  [0.35, -78.12],
  [10.49, -66.9],
  // Africa / Middle East
  [25.2, 55.27],
  [32.08, 34.78],
  [-26.2, 28.04],
  [30.06, 31.25],
  [-1.29, 36.82],
  [9.05, 7.49],
  [36.81, 10.18],
];

// Arc connections [fromIdx, toIdx]
const ARCS: [number, number][] = [
  // Original backbone
  [0, 20],
  [1, 46],
  [3, 25],
  [0, 25],
  [15, 50],
  [25, 50],
  [46, 55],
  [20, 55],
  [0, 65],
  [46, 65],
  [25, 46],
  [20, 46],
  // Extended — trans-Atlantic
  [0, 30],
  [1, 22],
  [5, 21],
  [8, 31],
  [11, 23],
  [19, 34],
  // Trans-Pacific
  [2, 56],
  [4, 58],
  [6, 59],
  [16, 57],
  [18, 63],
  // Europe ↔ Asia
  [21, 56],
  [23, 55],
  [27, 57],
  [33, 59],
  [35, 64],
  // Intra-region
  [20, 23],
  [30, 34],
  [55, 58],
  [56, 59],
  [65, 70],
  // South links
  [75, 20],
  [76, 46],
  [79, 55],
  [81, 65],
  [82, 46],
  // Extra density
  [0, 46],
  [1, 25],
  [20, 50],
  [25, 55],
  [46, 70],
];

function toRad(d: number) {
  return d * (Math.PI / 180);
}

function latLng3D(lat: number, lng: number, r: number) {
  const φ = toRad(90 - lat);
  const θ = toRad(lng + 180);
  return {
    x: -r * Math.sin(φ) * Math.cos(θ),
    y: r * Math.cos(φ),
    z: r * Math.sin(φ) * Math.sin(θ),
  };
}

function rotY(p: { x: number; y: number; z: number }, a: number) {
  return {
    x: p.x * Math.cos(a) - p.z * Math.sin(a),
    y: p.y,
    z: p.x * Math.sin(a) + p.z * Math.cos(a),
  };
}

function buildSphere(spacing: number) {
  const pts: { lat: number; lng: number }[] = [];
  for (let lat = -90; lat <= 90; lat += spacing) {
    const c = Math.cos(toRad(lat));
    const step = c < 0.05 ? 360 : spacing / c;
    for (let lng = -180; lng < 180; lng += step) {
      pts.push({ lat, lng });
    }
  }
  return pts;
}

export function GlobeAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const angle = useRef(0.4);
  const pulses = useRef<number[]>(VALIDATORS.map((_, i) => (i * 43) % 90));
  const arcProgress = useRef<number[]>(ARCS.map((_, i) => i * (1 / ARCS.length)));
  const [blockNum, setBlockNum] = useState(0);

  useEffect(() => {
    let base = 0;
    let ticks = 0;
    async function fetchBlock() {
      try {
        const res = await fetch("https://rpc.monad.xyz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
          signal: AbortSignal.timeout(4000),
        });
        const d = (await res.json()) as { result: string };
        base = parseInt(d.result, 16);
        ticks = 0;
        setBlockNum(base);
      } catch {}
    }
    fetchBlock();
    const iv = setInterval(() => {
      ticks++;
      setBlockNum(base + ticks);
      if (ticks % 8 === 0) fetchBlock();
    }, 500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    const size = container.clientWidth || 520;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const W = size;
    const H = size;
    const cx = W / 2;
    const cy = H / 2;
    const R = size * 0.38;
    const sphere = buildSphere(7);

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const a = angle.current;

      // Atmosphere glow
      const atmo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
      atmo.addColorStop(0, "rgba(109,40,217,0.06)");
      atmo.addColorStop(0.6, "rgba(88,28,135,0.04)");
      atmo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = atmo;
      ctx.fillRect(0, 0, W, H);

      // Precompute validator 3D positions
      const vPos = VALIDATORS.map(([lat, lng]) => rotY(latLng3D(lat, lng, R), a));

      // Sphere dots
      const dots = sphere.map((d) => {
        const p = rotY(latLng3D(d.lat, d.lng, R), a);
        return { sx: cx + p.x, sy: cy - p.y, depth: (p.z + R) / (2 * R), vis: p.z > -R * 0.05 };
      });
      dots.sort((a, b) => a.depth - b.depth);
      for (const d of dots) {
        if (!d.vis) continue;
        ctx.beginPath();
        ctx.arc(d.sx, d.sy, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139,92,246,${(d.depth * 0.42).toFixed(3)})`;
        ctx.fill();
      }

      // Arc connections with animated pulse
      for (let i = 0; i < ARCS.length; i++) {
        const [ai, bi] = ARCS[i]!;
        const A = vPos[ai % vPos.length]!;
        const B = vPos[bi % vPos.length]!;
        if (A.z < 0 || B.z < 0) continue;

        const sax = cx + A.x,
          say = cy - A.y;
        const sbx = cx + B.x,
          sby = cy - B.y;
        const mx = (sax + sbx) / 2;
        const my = (say + sby) / 2;
        const dx = mx - cx,
          dy = my - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const cpx = mx + (dx / dist) * R * 0.28;
        const cpy = my + (dy / dist) * R * 0.28;

        const alpha = Math.min((A.z + R) / (2 * R), (B.z + R) / (2 * R)) * 0.28;

        ctx.beginPath();
        ctx.moveTo(sax, say);
        ctx.quadraticCurveTo(cpx, cpy, sbx, sby);
        ctx.strokeStyle = `rgba(167,139,250,${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();

        arcProgress.current[i] = ((arcProgress.current[i] ?? 0) + 0.004) % 1;
        const t = arcProgress.current[i]!;
        const px = (1 - t) * (1 - t) * sax + 2 * (1 - t) * t * cpx + t * t * sbx;
        const py = (1 - t) * (1 - t) * say + 2 * (1 - t) * t * cpy + t * t * sby;
        ctx.beginPath();
        ctx.arc(px, py, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(196,181,253,${(alpha * 3).toFixed(3)})`;
        ctx.fill();
      }

      // Validator nodes
      const PULSE_FRAMES = 100;
      const sorted = [...vPos.entries()].sort(([, a], [, b]) => a.z - b.z);
      for (const [i, p] of sorted) {
        if (p.z < -R * 0.08) continue;
        const sx = cx + p.x;
        const sy = cy - p.y;
        const depth = (p.z + R) / (2 * R);

        pulses.current[i] = ((pulses.current[i] ?? 0) + 1) % PULSE_FRAMES;
        const pct = (pulses.current[i] ?? 0) / PULSE_FRAMES;

        // Expanding pulse ring
        if (pct < 0.7) {
          const ringR = R * 0.018 + pct * R * 0.12;
          const ringA = (1 - pct / 0.7) * 0.5 * depth;
          const rg = ctx.createRadialGradient(sx, sy, ringR * 0.3, sx, sy, ringR);
          rg.addColorStop(0, `rgba(196,181,253,${ringA.toFixed(3)})`);
          rg.addColorStop(1, "rgba(196,181,253,0)");
          ctx.beginPath();
          ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
          ctx.fillStyle = rg;
          ctx.fill();
        }

        // Outer glow halo
        const glowR = R * 0.06;
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
        glow.addColorStop(0, `rgba(167,139,250,${(depth * 0.75).toFixed(3)})`);
        glow.addColorStop(0.5, `rgba(124,58,237,${(depth * 0.25).toFixed(3)})`);
        glow.addColorStop(1, "rgba(124,58,237,0)");
        ctx.beginPath();
        ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Bright core dot
        ctx.beginPath();
        ctx.arc(sx, sy, R * 0.015, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(depth * 0.95).toFixed(3)})`;
        ctx.fill();
      }

      // Edge rim glow
      const rim = ctx.createRadialGradient(cx, cy, R * 0.87, cx, cy, R * 1.1);
      rim.addColorStop(0, "rgba(109,40,217,0)");
      rim.addColorStop(0.65, "rgba(109,40,217,0.16)");
      rim.addColorStop(1, "rgba(88,28,135,0.03)");
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = rim;
      ctx.fill();
    }

    function loop() {
      angle.current += 0.0022;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }

    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-[560px]">
      <motion.canvas
        ref={canvasRef}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none select-none"
        aria-hidden="true"
      />
      {blockNum > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 1.5 }}
          className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-center select-none"
          aria-hidden="true"
        >
          <div className="text-primary/[0.13] font-mono text-4xl font-black tracking-tight sm:text-5xl">
            {blockNum.toLocaleString()}
          </div>
          <div className="text-foreground/[0.07] mt-1 text-[10px] font-semibold tracking-[0.3em] uppercase">
            Monad Block
          </div>
        </motion.div>
      )}
    </div>
  );
}
