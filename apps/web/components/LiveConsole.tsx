"use client";

import { useState } from "react";

type Preset = { label: string; tool: string; args: Record<string, unknown> };

const PRESETS: Preset[] = [
  { label: "Live chain snapshot", tool: "get_onchain_snapshot", args: { top_n: 5 } },
  { label: "One validator, live", tool: "get_validator_onchain", args: { id: "backpack" } },
  { label: "Network health (indexed)", tool: "get_network_health", args: {} },
  {
    label: "Reward estimate",
    tool: "estimate_stake_reward",
    args: { stake_mon: 10000, days: 90, commission_bps: 500 },
  },
];

type Result = {
  status: number;
  ms: number;
  body: unknown;
};

type Envelope = {
  data_class_label?: string;
  data?: { as_of_block?: number; epoch?: number } | null;
  freshness?: { indexed_at: string | null; stale: boolean };
};

const mono = "var(--font-mono), monospace";

/** Runs a real request against /api/v1/tools from the visitor's browser. */
export default function LiveConsole() {
  const [active, setActive] = useState<Preset>(PRESETS[0]!);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(preset: Preset) {
    setActive(preset);
    setBusy(true);
    setError(null);
    setResult(null);
    const t0 = performance.now();
    try {
      const res = await fetch(`/api/v1/tools/${preset.tool}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset.args),
      });
      const body: unknown = await res.json();
      setResult({ status: res.status, ms: Math.round(performance.now() - t0), body });
    } catch {
      setError("Request failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const env = (result?.body ?? null) as Envelope | null;
  const block = env?.data && typeof env.data === "object" ? env.data.as_of_block : undefined;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "12px",
        overflow: "hidden",
        background: "linear-gradient(180deg, rgba(10,8,30,.6), rgba(7,6,22,.85))",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          padding: "12px 14px",
          borderBottom: "1px solid rgba(124,92,255,.14)",
        }}
      >
        {PRESETS.map((p) => (
          <button
            key={p.tool}
            type="button"
            onClick={() => void run(p)}
            disabled={busy}
            style={{
              fontFamily: mono,
              fontSize: "11px",
              letterSpacing: ".06em",
              padding: "7px 12px",
              borderRadius: "7px",
              cursor: busy ? "wait" : "pointer",
              color: active.tool === p.tool ? "var(--text)" : "var(--text-dim)",
              background: active.tool === p.tool ? "rgba(124,92,255,.22)" : "transparent",
              border: `1px solid ${active.tool === p.tool ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "12px 14px", fontFamily: mono, fontSize: "12px" }}>
        <div style={{ color: "var(--text-mute)", marginBottom: "8px", wordBreak: "break-all" }}>
          <span style={{ color: "var(--accent-hover)" }}>POST</span> /api/v1/tools/{active.tool}{" "}
          <span style={{ color: "var(--text-dim)" }}>{JSON.stringify(active.args)}</span>
        </div>

        {!result && !busy && !error && (
          <div style={{ color: "var(--text-dim)" }}>
            Pick a call. The request runs from your browser against the live API.
          </div>
        )}
        {busy && (
          <div style={{ color: "var(--text-dim)" }} role="status">
            reading…{" "}
            {active.tool === "get_onchain_snapshot" &&
              "(a cold snapshot reads every validator from the precompile and takes a few seconds)"}
          </div>
        )}
        {error && <div style={{ color: "#ff8f8f" }}>{error}</div>}

        {result && (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 16px",
                marginBottom: "10px",
                color: "var(--text-dim)",
              }}
            >
              <span>
                HTTP{" "}
                <b style={{ color: result.status < 400 ? "#5ce0a8" : "#ff8f8f" }}>
                  {result.status}
                </b>
              </span>
              <span>{result.ms} ms</span>
              {env?.data_class_label && (
                <span style={{ color: "var(--text)" }}>{env.data_class_label}</span>
              )}
              {typeof block === "number" && (
                <span>
                  block <b style={{ color: "var(--text)" }}>#{block.toLocaleString("en-US")}</b>
                </span>
              )}
              {env?.freshness && (
                <span style={{ color: env.freshness.stale ? "#e0b15c" : "#5ce0a8" }}>
                  index {env.freshness.stale ? "stale" : "fresh"}
                  {env.freshness.indexed_at ? ` · ${env.freshness.indexed_at.slice(0, 16)}Z` : ""}
                </span>
              )}
            </div>
            <pre
              tabIndex={0}
              style={{
                margin: 0,
                maxHeight: "360px",
                overflow: "auto",
                padding: "12px",
                borderRadius: "8px",
                background: "rgba(0,0,0,.35)",
                color: "var(--text)",
                fontSize: "11.5px",
                lineHeight: 1.55,
              }}
            >
              {JSON.stringify(result.body, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
