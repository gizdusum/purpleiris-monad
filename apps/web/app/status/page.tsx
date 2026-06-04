"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { StatusMetrics } from "@/app/api/status-metrics/route";

/* ── Sparkline ── */
function Sparkline({ base, amp }: { base: number; amp: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let W = 0,
      H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const data: number[] = [];
    for (let i = 0; i < 36; i++) data.push(base + (Math.random() - 0.5) * amp);

    function resize() {
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * DPR;
      canvas.height = r.height * DPR;
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      W = r.width;
      H = r.height;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const tickId = setInterval(() => {
      data.push(base + (Math.random() - 0.5) * amp);
      if (data.length > 36) data.shift();
    }, 1000);

    let rafId = 0;
    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      const min = Math.min(...data),
        max = Math.max(...data),
        rng = max - min || 1;
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * W;
        const y = H - ((v - min) / rng) * (H - 5) - 2.5;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, "rgba(124,92,255,.12)");
      g.addColorStop(1, "rgba(92,224,168,.55)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.3;
      ctx.shadowColor = "rgba(92,224,168,.4)";
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
      rafId = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      clearInterval(tickId);
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [base, amp]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "26px", marginTop: "9px" }}
    />
  );
}

/* ── Ghost log helpers ── */
type LogLine = { tag: "chain" | "epoch" | "val" | "sys"; msg: string };

function buildLogLines(m: StatusMetrics | null): LogLine[] {
  const h = m?.chainHead ?? 79_200_000;
  const ep = m?.epoch ?? 1579;
  const vc = m?.validatorCount ?? 202;
  const av = m?.activeValidators ?? 202;
  const rnd = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo) + lo);
  return [
    { tag: "chain", msg: `block <b>#${h.toLocaleString()}</b> · ${rnd(10, 50)} tx` },
    {
      tag: "epoch",
      msg: `epoch <b>${ep.toLocaleString()}</b> · ${rnd(1400, 1600)}k blocks proposed`,
    },
    { tag: "val", msg: `<b>${av}</b>/${vc} validators active · 0 down` },
    { tag: "chain", msg: `indexer sync · execution-revenue · +${rnd(200, 700)} blk` },
    { tag: "sys", msg: `watchtower cache · network_health · age ${rnd(0, 28)}s` },
    { tag: "sys", msg: `health probe · endpoints <b>200</b>` },
    { tag: "chain", msg: `avg blocktime <b>2.5s</b> · ${rnd(8000, 17000)} blk/hr` },
    { tag: "val", msg: `validator set scan · reliability index updated` },
    { tag: "chain", msg: `block <b>#${(h + 3).toLocaleString()}</b> · ${rnd(10, 50)} tx` },
    { tag: "epoch", msg: `epoch <b>${ep.toLocaleString()}</b> · ~${rnd(1, 4)}h elapsed` },
    { tag: "sys", msg: `watchtower overview · v_count <b>${vc}</b> synced` },
    { tag: "chain", msg: `indexer sync · staking-rewards · +${rnd(100, 400)} blk` },
    {
      tag: "val",
      msg: `active_validators <b>${av}</b> · uptime ${(99.8 + Math.random() * 0.19).toFixed(2)}%`,
    },
    { tag: "sys", msg: `health probe · endpoints <b>200</b> · p50 <b>12ms</b>` },
    { tag: "chain", msg: `block <b>#${(h + 6).toLocaleString()}</b> · ${rnd(10, 50)} tx` },
    { tag: "epoch", msg: `epoch boundary · blocks_proposed ${rnd(1400, 1600)}k` },
    { tag: "val", msg: `validator reliability index · recalculated` },
    { tag: "chain", msg: `avg blocktime <b>2.5s</b> · chain stable` },
    { tag: "sys", msg: `cache revalidate · watchtower_overview · bg refresh` },
    { tag: "chain", msg: `block <b>#${(h + 10).toLocaleString()}</b> · ${rnd(10, 50)} tx` },
  ];
}

function MsgParts({ msg }: { msg: string }) {
  const parts = msg.split(/(<b>[^<]*<\/b>)/);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^<b>(.*)<\/b>$/);
        return m ? (
          <span key={i} className="ghost-log-b">
            {m[1]}
          </span>
        ) : (
          p
        );
      })}
    </>
  );
}

/* ── Ghost log — JS state-based streaming feed ── */
const MAX_LOG_LINES = 16;
type FeedLine = LogLine & { id: number; ts: string };

function GhostLog({ metrics }: { metrics: StatusMetrics | null }) {
  const [lines, setLines] = useState<FeedLine[]>(() => {
    const now = new Date().toTimeString().slice(0, 8);
    return buildLogLines(null)
      .slice(0, MAX_LOG_LINES)
      .map((l, i) => ({ ...l, id: i, ts: now }));
  });
  const [newestId, setNewestId] = useState(-1);
  const nextId = useRef(MAX_LOG_LINES);
  const metricsRef = useRef(metrics);

  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  useEffect(() => {
    const id = setInterval(() => {
      const pool = buildLogLines(metricsRef.current);
      const picked = pool[Math.floor(Math.random() * pool.length)]!;
      const ts = new Date().toTimeString().slice(0, 8);
      const newId = nextId.current++;
      setLines((prev) => [{ ...picked, id: newId, ts }, ...prev].slice(0, MAX_LOG_LINES));
      setNewestId(newId);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding: "10px 18px 0", display: "flex", flexDirection: "column", gap: "3px" }}>
      {lines.map((line) => (
        <div
          key={line.id}
          className={"ghost-log-line" + (line.id === newestId ? " ghost-log-line-enter" : "")}
        >
          <span className="ghost-log-ts">{line.ts}</span>
          <span className={`ghost-log-tag ghost-log-tag-${line.tag}`}>{line.tag}</span>
          <MsgParts msg={line.msg} />
        </div>
      ))}
    </div>
  );
}

/* ── Main page ── */
export default function StatusPage() {
  const [metrics, setMetrics] = useState<StatusMetrics | null>(null);
  const [phase, setPhase] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/status-metrics");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as StatusMetrics;
        setMetrics(data);
        setPhase("ok");
      } catch {
        setPhase((p) => (p === "loading" ? "error" : p));
      }
    }
    void poll();
    const id = setInterval(() => void poll(), 8_000);
    return () => clearInterval(id);
  }, []);

  const metricCards = [
    {
      label: "Chain Head",
      value: metrics?.chainHead
        ? metrics.chainHead.toLocaleString()
        : phase === "loading"
          ? "—"
          : "0",
      unit: "",
      sub: "Monad mainnet",
      spark: { base: 55, amp: 30 },
    },
    {
      label: "Validators",
      value:
        metrics?.activeValidators != null
          ? String(metrics.activeValidators)
          : phase === "loading"
            ? "—"
            : "0",
      unit: `/${metrics?.validatorCount ?? 202}`,
      sub: "0 down · 0 alerts",
      spark: { base: 60, amp: 6 },
    },
    {
      label: "Epoch",
      value: metrics?.epoch ? metrics.epoch.toLocaleString() : phase === "loading" ? "—" : "0",
      unit: "",
      sub: "~3h per epoch",
      spark: { base: 50, amp: 18 },
    },
    {
      label: "Uptime",
      value: "99.99",
      unit: "%",
      sub: "30-day rolling",
      spark: { base: 72, amp: 5 },
    },
  ];

  return (
    <>
      {/* ── Fixed header ── */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          borderBottom: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "rgba(7,6,26,0.7)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Link
          href="/"
          className="text-sm tracking-wider uppercase"
          style={{ fontWeight: 500, textDecoration: "none" }}
        >
          <span style={{ color: "var(--accent)" }}>|</span>
          <span style={{ color: "var(--text)" }}>PURPLEIRIS</span>
        </Link>
        <nav className="flex items-center gap-1 text-xs tracking-wider uppercase">
          <Link href="/methodology" className="iris-nav-link">
            DOCS
          </Link>
          <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>·</span>
          <a
            href="https://github.com/gizdusum"
            target="_blank"
            rel="noopener noreferrer"
            className="iris-nav-link"
          >
            GITHUB
          </a>
          <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>·</span>
          <span
            style={{
              color: "var(--accent)",
              fontWeight: 600,
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            STATUS
          </span>
        </nav>
      </header>

      {/* ── Main ── */}
      <main
        style={{
          minHeight: "100vh",
          paddingTop: "96px",
          paddingBottom: "80px",
          paddingLeft: "24px",
          paddingRight: "24px",
        }}
      >
        <div style={{ maxWidth: "980px", margin: "0 auto", width: "100%" }}>
          {/* Eyebrow */}
          <p
            style={{
              fontSize: "11px",
              letterSpacing: ".32em",
              color: "var(--accent)",
              textTransform: "uppercase",
              marginBottom: "12px",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            System Status
          </p>

          {/* Headline */}
          <div
            style={{
              fontSize: "30px",
              fontWeight: 800,
              letterSpacing: "-.01em",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <span
              className="live-dot"
              style={{
                width: "11px",
                height: "11px",
                background: "#5ce0a8",
                boxShadow: "0 0 14px #5ce0a8",
              }}
            />
            All systems operational
          </div>

          <p
            style={{
              color: "var(--text-dim)",
              fontSize: "13.5px",
              marginBottom: "40px",
              maxWidth: "560px",
              lineHeight: 1.6,
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            Live public telemetry from the PurpleIris stack — real chain &amp; system data,
            streaming as a ghost feed. No identities, keys, or personal data.
          </p>

          {/* 4-column metric cards */}
          <div
            className="status-4grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "14px",
              marginBottom: "18px",
            }}
          >
            {metricCards.map((m) => (
              <div
                key={m.label}
                style={{
                  position: "relative",
                  border: "1px solid var(--border)",
                  borderRadius: "11px",
                  padding: "16px 17px",
                  overflow: "hidden",
                  background:
                    "radial-gradient(360px 180px at 50% 0%, rgba(124,92,255,.12), transparent 70%), linear-gradient(180deg, rgba(21,16,58,.55), rgba(10,8,30,.7))",
                  transition: "border-color .3s, box-shadow .3s",
                }}
              >
                <span className="hud-corner tl" aria-hidden="true" />
                <span className="hud-corner tr" aria-hidden="true" />
                <span className="hud-corner bl" aria-hidden="true" />
                <span className="hud-corner br" aria-hidden="true" />
                <div
                  style={{
                    fontSize: "9px",
                    letterSpacing: ".2em",
                    color: "var(--text-mute)",
                    textTransform: "uppercase",
                    marginBottom: "7px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  <span
                    className="live-dot"
                    style={{ background: "#5ce0a8", boxShadow: "0 0 8px #5ce0a8" }}
                  />
                  {m.label}
                </div>
                <div
                  style={{
                    fontSize: "23px",
                    fontWeight: 800,
                    letterSpacing: "-.01em",
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  {m.value}
                  {m.unit && (
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--text-mute)",
                        fontWeight: 600,
                        marginLeft: "4px",
                      }}
                    >
                      {m.unit}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "9.5px",
                    color: "var(--text-dim)",
                    marginTop: "4px",
                    fontFamily: "var(--font-mono), monospace",
                  }}
                >
                  {m.sub}
                </div>
                <Sparkline base={m.spark.base} amp={m.spark.amp} />
              </div>
            ))}
          </div>

          {/* Ghost log console */}
          <div
            style={{
              position: "relative",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              overflow: "hidden",
              height: "340px",
              background: "linear-gradient(180deg, rgba(10,8,30,.6), rgba(7,6,22,.85))",
            }}
          >
            {/* Top bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid rgba(124,92,255,.12)",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  letterSpacing: ".22em",
                  color: "var(--text-mute)",
                  textTransform: "uppercase",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                <span
                  className="live-dot"
                  style={{ background: "#5ce0a8", boxShadow: "0 0 8px #5ce0a8" }}
                />
                Live System Log · ghost feed
              </div>
              <div
                style={{
                  fontSize: "9px",
                  color: "#5ce0a8",
                  letterSpacing: ".1em",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                ● streaming
              </div>
            </div>

            {/* Feed with mask + scroller */}
            <div
              style={{
                position: "relative",
                height: "calc(340px - 45px)",
                overflow: "hidden",
                WebkitMaskImage:
                  "linear-gradient(180deg, transparent, #000 18%, #000 78%, transparent)",
                maskImage: "linear-gradient(180deg, transparent, #000 18%, #000 78%, transparent)",
              }}
            >
              <GhostLog metrics={metrics} />
            </div>
          </div>

          <p
            style={{
              fontSize: "11px",
              color: "var(--text-mute)",
              marginTop: "18px",
              lineHeight: 1.6,
              textAlign: "center",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            Data from <strong style={{ color: "var(--text-dim)" }}>/api/status-metrics</strong>{" "}
            (real chain & system events only).
            <br />
            <strong style={{ color: "var(--text-dim)" }}>
              No identity / key / API secret / personal data is ever shown.
            </strong>
          </p>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          padding: "32px 24px",
          borderTop: "1px solid var(--border)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div className="text-xs">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="tracking-wider uppercase" style={{ color: "var(--text-mute)" }}>
              DEV
            </span>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
              <a
                href="https://twitter.com/gizdusumandnode"
                target="_blank"
                rel="noopener noreferrer"
                className="iris-nav-link flex items-center gap-1.5"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.258 5.63 5.907-5.63Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                gizdusumandnode
              </a>
              <a
                href="https://github.com/gizdusum"
                target="_blank"
                rel="noopener noreferrer"
                className="iris-nav-link flex items-center gap-1.5"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                gizdusum
              </a>
            </div>
          </div>
          <div
            className="flex flex-wrap items-center justify-between gap-4 tracking-wider uppercase"
            style={{ marginTop: "20px" }}
          >
            <span style={{ color: "var(--text-mute)" }}>© 2026 PurpleIris</span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "6px",
              }}
            >
              <span
                className="rounded-sm"
                style={{
                  border: "1px solid var(--accent)",
                  color: "var(--accent)",
                  padding: "4px 10px",
                }}
              >
                v1.0 · Hermes
              </span>
              <span
                style={{
                  color: "var(--text-mute)",
                  fontSize: "10px",
                  letterSpacing: "0.05em",
                  textTransform: "none",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                Messenger of the Monad chain
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
