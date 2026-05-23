"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type HealthData = {
  status: string;
  version: string;
  codename: string;
  service: string;
};

type State = { phase: "loading" } | { phase: "ok"; data: HealthData } | { phase: "error" };

export default function StatusPage() {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HealthData>;
      })
      .then((data) => setState({ phase: "ok", data }))
      .catch(() => setState({ phase: "error" }));
  }, []);

  const isLive = state.phase === "ok" && state.data.status === "ok";
  const dotColor = state.phase === "loading" ? "var(--text-mute)" : isLive ? "#4ade80" : "#f87171";
  const statusLabel =
    state.phase === "loading"
      ? "Checking…"
      : isLive
        ? "All systems operational"
        : "Unable to reach service";

  const data = state.phase === "ok" ? state.data : null;

  return (
    <>
      {/* ── Fixed header — mirrors homepage / methodology ── */}
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
            href="https://github.com/gizdusum/purpleiris"
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

      {/* ── Main content ── */}
      <main
        style={{
          minHeight: "100vh",
          paddingTop: "96px",
          paddingBottom: "80px",
          paddingLeft: "24px",
          paddingRight: "24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ maxWidth: "520px", margin: "0 auto", width: "100%" }}>
          {/* Label */}
          <p
            style={{
              color: "var(--text-mute)",
              fontSize: "0.65rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              fontWeight: 600,
              marginBottom: "20px",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            System Status
          </p>

          {/* Status indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
            <span
              style={{
                fontSize: "1.1rem",
                color: dotColor,
                lineHeight: 1,
                transition: "color 300ms ease",
              }}
            >
              ●
            </span>
            <span
              style={{
                color: state.phase === "loading" ? "var(--text-mute)" : "var(--text)",
                fontSize: "1.25rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                transition: "color 300ms ease",
              }}
            >
              {statusLabel}
            </span>
          </div>

          {/* Metadata rows */}
          <div
            style={{
              backgroundColor: "var(--bg-elev)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            {[
              { key: "SERVICE", value: data?.service ?? "purpleiris-web" },
              {
                key: "VERSION",
                value: data?.version ? `v${data.version}` : "v1.0.0",
              },
              { key: "CODENAME", value: data?.codename ?? "Hermes" },
              {
                key: "STATE",
                value: state.phase === "loading" ? "—" : isLive ? "Live" : "Unreachable",
                accent: state.phase !== "loading",
                accentColor: isLive ? "#4ade80" : "#f87171",
              },
            ].map(({ key, value, accent, accentColor }, i, arr) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 20px",
                  borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                  gap: "16px",
                }}
              >
                <span
                  style={{
                    color: "var(--text-mute)",
                    fontSize: "0.7rem",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-mono), monospace",
                    flexShrink: 0,
                  }}
                >
                  {key}
                </span>
                <span
                  style={{
                    color: accent ? accentColor : "var(--text)",
                    fontSize: "0.875rem",
                    fontFamily: "var(--font-mono), monospace",
                    fontWeight: accent ? 600 : 400,
                    textAlign: "right",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Endpoint note */}
          <p
            style={{
              color: "var(--text-mute)",
              fontSize: "0.7rem",
              letterSpacing: "0.05em",
              marginTop: "16px",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            <Link
              href="/api/health"
              className="iris-nav-link"
              style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}
            >
              /api/health
            </Link>{" "}
            · fetched client-side on page load
          </p>
        </div>
      </main>

      {/* ── Footer — exact copy from homepage / methodology ── */}
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
