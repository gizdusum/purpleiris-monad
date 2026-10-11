"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { StatusMetrics } from "@/app/api/status-metrics/route";

/* ── Sparkline — plots a real series; renders nothing until it has two points ── */
function Sparkline({ series }: { series: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width * DPR;
    canvas.height = r.height * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const W = r.width;
    const H = r.height;
    ctx.clearRect(0, 0, W, H);
    if (series.length < 2) return;

    const min = Math.min(...series);
    const rng = Math.max(...series) - min || 1;
    ctx.beginPath();
    series.forEach((v, i) => {
      const x = (i / (series.length - 1)) * W;
      const y = H - ((v - min) / rng) * (H - 5) - 2.5;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "rgba(124,92,255,.12)");
    g.addColorStop(1, "rgba(92,224,168,.55)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }, [series]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "26px", marginTop: "9px" }}
    />
  );
}

/* ── Event log — one batch of lines per poll, built only from the API response ── */
type LogLine = { tag: "chain" | "epoch" | "val" | "sys"; msg: string };
type FeedLine = LogLine & { id: number; ts: string };

const MAX_LOG_LINES = 16;

function formatAge(seconds: number | null): string {
  if (seconds === null) return "unknown";
  if (seconds < 90) return `${seconds}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m`;
  if (seconds < 172_800) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

/** Lines for one poll. `prev` is the previous poll, used for real deltas only. */
function describePoll(m: StatusMetrics, prev: StatusMetrics | null): LogLine[] {
  const lines: LogLine[] = [];

  if (m.sources.rpc === "ok") {
    const delta = prev && prev.chainHead > 0 ? m.chainHead - prev.chainHead : null;
    lines.push({
      tag: "chain",
      msg:
        `block <b>#${m.chainHead.toLocaleString("en-US")}</b>` +
        (delta !== null && delta > 0 ? ` · +${delta.toLocaleString("en-US")} since last poll` : ""),
    });
    if (m.epochSource === "staking-precompile") {
      lines.push({
        tag: "epoch",
        msg:
          `epoch <b>${m.epoch.toLocaleString("en-US")}</b> · getEpoch() on staking precompile` +
          (m.inEpochDelayPeriod ? " · in delay period" : ""),
      });
    }
  } else {
    lines.push({ tag: "chain", msg: "rpc unreachable · chain head unavailable" });
  }

  if (m.sources.database === "ok") {
    lines.push({
      tag: "val",
      msg:
        `<b>${m.activeValidators}</b>/${m.validatorCount} validators active in index · ` +
        `last sync ${formatAge(m.index.ageSeconds)} ago` +
        (m.index.stale ? " · <b>stale</b>" : ""),
    });
  } else {
    lines.push({ tag: "val", msg: "database unreachable · validator index unavailable" });
  }

  lines.push({
    tag: "sys",
    msg: `sources · rpc <b>${m.sources.rpc}</b> · database <b>${m.sources.database}</b> · watchtower <b>${m.sources.watchtower}</b>`,
  });

  return lines;
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

function EventLog({ lines, newestBatch }: { lines: FeedLine[]; newestBatch: number }) {
  if (lines.length === 0) {
    return (
      <div className="ghost-log-line" style={{ padding: "10px 18px 0" }}>
        waiting for the first measurement…
      </div>
    );
  }
  return (
    <div style={{ padding: "10px 18px 0", display: "flex", flexDirection: "column", gap: "3px" }}>
      {lines.map((line) => (
        <div
          key={line.id}
          className={"ghost-log-line" + (line.id >= newestBatch ? " ghost-log-line-enter" : "")}
        >
          <span className="ghost-log-ts">{line.ts}</span>
          <span className={`ghost-log-tag ghost-log-tag-${line.tag}`}>{line.tag}</span>
          <MsgParts msg={line.msg} />
        </div>
      ))}
    </div>
  );
}

type Health = { label: string; color: string };

function overallHealth(m: StatusMetrics | null, phase: "loading" | "ok" | "error"): Health {
  if (!m) {
    return phase === "error"
      ? { label: "Status unavailable", color: "#ff6b6b" }
      : { label: "Checking systems…", color: "#8a84b8" };
  }
  const { rpc, database } = m.sources;
  if (rpc === "down" || database === "down") return { label: "Partial outage", color: "#ff6b6b" };
  if (m.index.stale) return { label: "Degraded — validator index is behind", color: "#e0b15c" };
  if (m.sources.watchtower === "down") {
    return { label: "Degraded — performance feed unreachable", color: "#e0b15c" };
  }
  return { label: "All systems operational", color: "#5ce0a8" };
}

/* ── Main page ── */
export default function StatusPage() {
  const [metrics, setMetrics] = useState<StatusMetrics | null>(null);
  const [phase, setPhase] = useState<"loading" | "ok" | "error">("loading");
  const [lines, setLines] = useState<FeedLine[]>([]);
  const [newestBatch, setNewestBatch] = useState(0);
  const [headSeries, setHeadSeries] = useState<number[]>([]);
  const prevRef = useRef<StatusMetrics | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/status-metrics", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as StatusMetrics;
        const prev = prevRef.current;

        // The endpoint caches for 30s; only log a measurement once.
        if (!prev || prev.checkedAt !== data.checkedAt) {
          const ts = new Date(data.checkedAt).toTimeString().slice(0, 8);
          const first = nextId.current;
          const batch = describePoll(data, prev).map((l) => ({ ...l, id: nextId.current++, ts }));
          setNewestBatch(first);
          setLines((old) => [...batch, ...old].slice(0, MAX_LOG_LINES));
          if (data.chainHead > 0) setHeadSeries((old) => [...old, data.chainHead].slice(-36));
          prevRef.current = data;
        }

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

  const health = overallHealth(metrics, phase);
  const dash = phase === "loading" ? "—" : "n/a";
  const up = (ok: boolean) => (ok ? "#5ce0a8" : "#ff6b6b");

  const metricCards = [
    {
      label: "Chain Head",
      value: metrics && metrics.chainHead > 0 ? metrics.chainHead.toLocaleString("en-US") : dash,
      unit: "",
      sub:
        metrics?.sources.rpc === "ok"
          ? "Monad mainnet · eth_blockNumber"
          : "Monad mainnet · RPC unreachable",
      dot: up(metrics?.sources.rpc === "ok"),
      series: headSeries,
    },
    {
      label: "Validators",
      value: metrics?.sources.database === "ok" ? String(metrics.activeValidators) : dash,
      unit: metrics?.sources.database === "ok" ? `/${metrics.validatorCount}` : "",
      sub: metrics?.index.indexedAt
        ? `active in index · as of ${metrics.index.indexedAt.slice(0, 10)}`
        : "active in index",
      dot: up(metrics?.sources.database === "ok" && !metrics.index.stale),
      series: [] as number[],
    },
    {
      label: "Epoch",
      value: metrics && metrics.epoch > 0 ? metrics.epoch.toLocaleString("en-US") : dash,
      unit: "",
      sub:
        metrics?.epochSource === "staking-precompile"
          ? "getEpoch() · staking precompile"
          : metrics?.epochSource === "watchtower"
            ? "via watchtower"
            : "unavailable",
      dot: up(!!metrics && metrics.epoch > 0),
      series: [] as number[],
    },
    {
      label: "Index Age",
      value: metrics ? formatAge(metrics.index.ageSeconds) : dash,
      unit: "",
      sub: metrics?.index.stale ? "validator index is stale" : "since last validator sync",
      dot: metrics?.index.stale === false ? "#5ce0a8" : "#e0b15c",
      series: [] as number[],
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
          className="text-sm uppercase tracking-wider"
          style={{ fontWeight: 500, textDecoration: "none" }}
        >
          <span style={{ color: "var(--accent)" }}>|</span>
          <span style={{ color: "var(--text)" }}>PURPLEIRIS</span>
        </Link>
        <nav className="flex items-center gap-1 text-xs uppercase tracking-wider">
          <Link href="/methodology" className="iris-nav-link">
            DOCS
          </Link>
          <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>·</span>
          <Link href="/developers" className="iris-nav-link">
            API
          </Link>
          <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>·</span>
          <a
            href="https://github.com/gizdusum/purpleiris-monad"
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
                background: health.color,
                boxShadow: `0 0 14px ${health.color}`,
              }}
            />
            {health.label}
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
            Measured, not simulated. Every value on this page comes from one request to{" "}
            <code>/api/status-metrics</code>, repeated every few seconds. When a source is
            unreachable or the validator index is behind, this page says so.
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
                    style={{ background: m.dot, boxShadow: `0 0 8px ${m.dot}` }}
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
                <Sparkline series={m.series} />
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
                Measurement Log
              </div>
              <div
                style={{
                  fontSize: "9px",
                  color: "#5ce0a8",
                  letterSpacing: ".1em",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {metrics
                  ? `last check ${new Date(metrics.checkedAt).toTimeString().slice(0, 8)}`
                  : "…"}
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
              <EventLog lines={lines} newestBatch={newestBatch} />
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
            Data from <strong style={{ color: "var(--text-dim)" }}>/api/status-metrics</strong>:
            chain head and epoch are read from Monad mainnet, validator counts from the indexer.
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
            <span className="uppercase tracking-wider" style={{ color: "var(--text-mute)" }}>
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
            className="flex flex-wrap items-center justify-between gap-4 uppercase tracking-wider"
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
