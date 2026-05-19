import Link from "next/link";
import dynamic from "next/dynamic";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { FrostedFutureCard } from "@/components/FrostedFutureCard";

export const metadata: Metadata = {
  title: "PurpleIris — Monad Validator Intelligence",
};

const IrisBackdrop = dynamic(() => import("@/components/IrisBackdrop"), { ssr: false });
const HeroSection = dynamic(() => import("@/components/HeroSection"), {
  ssr: false,
  loading: () => <div style={{ height: "100vh" }} />,
});

/* ─── Card data ─── */
type Bar = { label: string; value: number | null };
type Spec = { key: string; value: string };
type CardDef = {
  id: string;
  category: string;
  catColor: string;
  name: string;
  bars: Bar[];
  specs: Spec[];
  copy: string;
  cta: string;
  href: string;
  disabled: boolean;
};

const cards: CardDef[] = [
  {
    id: "delegator",
    category: "CASUAL",
    catColor: "var(--cat-casual)",
    name: "DELEGATOR",
    bars: [
      { label: "READINESS", value: 9 },
      { label: "DEPTH", value: 7 },
      { label: "LATENCY", value: 9 },
    ],
    specs: [
      { key: "MODE:", value: "conversational" },
      { key: "OUTPUT:", value: "validator lists" },
      { key: "BOUNDARY:", value: "non-advisory" },
    ],
    copy: "Ask anything about Monad staking. Get validator data, never advice.",
    cta: "ENTER →",
    href: "/chat/delegator",
    disabled: false,
  },
  {
    id: "operator",
    category: "OPERATOR",
    catColor: "var(--cat-operator)",
    name: "OPERATOR",
    bars: [
      { label: "READINESS", value: 6 },
      { label: "DEPTH", value: 10 },
      { label: "LATENCY", value: 8 },
    ],
    specs: [
      { key: "MODE:", value: "technical" },
      { key: "OUTPUT:", value: "metrics + commands" },
      { key: "ACCESS:", value: "read-only (v1.0)" },
    ],
    copy: "Run validator diagnostics. Inspect performance, commission, uptime.",
    cta: "ENTER →",
    href: "/chat/operator",
    disabled: false,
  },
  {
    id: "stake-sim",
    category: "FORECAST",
    catColor: "var(--cat-forecast)",
    name: "STAKE SIM",
    bars: [
      { label: "READINESS", value: 0 },
      { label: "DEPTH", value: 10 },
      { label: "LATENCY", value: null },
    ],
    specs: [
      { key: "MODE:", value: "forecast" },
      { key: "STATUS:", value: "coming soon" },
      { key: "RELEASE:", value: "v2.0 Pythia" },
    ],
    copy: "Project your rewards across scenarios. Ships in v2.0 with audited vault contracts.",
    cta: "COMING SOON",
    href: "#",
    disabled: true,
  },
];

const futureCards = [
  { version: "v1.1", codename: "ARGUS" },
  { version: "v1.2", codename: "MNEMOSYNE" },
  { version: "v2.0", codename: "PYTHIA" },
];

/* ─── Page ─── */
export default function HomePage() {
  return (
    <>
      {/* Fixed iris backdrop — hero intensity with scroll darkening */}
      <IrisBackdrop intensity="hero" />

      {/* Header */}
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
        <span className="text-sm tracking-wider uppercase" style={{ fontWeight: 500 }}>
          <span style={{ color: "var(--accent)" }}>|</span>
          <span style={{ color: "var(--text)" }}>PURPLEIRIS</span>
        </span>
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
          <Link href="/api/health" className="iris-nav-link">
            STATUS
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <HeroSection />

      {/* Card grid — transparent so backdrop shows through */}
      <section
        style={{
          maxWidth: "1152px",
          margin: "0 auto",
          padding: "0 24px",
          marginTop: "80px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {cards.map((card) => (
            <ModeCard key={card.id} card={card} />
          ))}
        </div>
      </section>

      {/* Coming next — frosted future cards */}
      <section
        style={{
          maxWidth: "720px",
          margin: "80px auto 0",
          padding: "0 24px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <p
          className="text-center text-xs tracking-[0.3em] uppercase"
          style={{ color: "var(--text-mute)", marginBottom: "24px" }}
        >
          COMING NEXT
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {futureCards.map((c) => (
            <FrostedFutureCard key={c.codename} version={c.version} codename={c.codename} />
          ))}
        </div>
      </section>

      {/* Footer — transparent */}
      <footer
        style={{
          marginTop: "80px",
          padding: "32px 24px",
          borderTop: "1px solid var(--border)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div className="text-xs">
          <p className="text-center" style={{ color: "var(--text-dim)" }}>
            All Hermes responses carry data-class labels:{" "}
            <span style={{ color: "var(--text)" }}>CLASS 1</span> on-chain{" · "}
            <span style={{ color: "var(--text)" }}>CLASS 2</span> derived{" · "}
            <span style={{ color: "var(--text)" }}>CLASS 3</span> estimated.{" "}
            <Link
              href="/methodology"
              className="iris-nav-link"
              style={{ textDecoration: "underline" }}
            >
              Read the methodology →
            </Link>
          </p>
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

/* ─── Mode card component ─── */
function ModeCard({ card }: { card: CardDef }) {
  const { category, catColor, name, bars, specs, copy, cta, href, disabled } = card;

  const inner = (
    <div
      className="mode-card relative flex h-full flex-col rounded-md"
      style={
        {
          borderTopColor: catColor,
          "--cta-color": catColor,
          padding: "28px",
        } as CSSProperties
      }
    >
      <p
        className="text-xs tracking-[0.25em] uppercase"
        style={{ color: catColor, fontWeight: 600 }}
      >
        {category}
      </p>

      <h2
        className="font-bold uppercase"
        style={{
          color: "var(--text)",
          fontSize: "1.875rem",
          letterSpacing: "-0.02em",
          marginTop: "8px",
        }}
      >
        {name}
      </h2>

      <div style={{ borderTop: "1px solid var(--border)", margin: "20px 0" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3">
            <span
              className="text-xs tracking-wider uppercase"
              style={{ color: "var(--text-mute)", minWidth: "90px" }}
            >
              {bar.label}
            </span>
            {bar.value === null ? (
              <span
                className="text-xs"
                style={{ color: "var(--text-mute)", flex: 1, maxWidth: "120px" }}
              >
                —
              </span>
            ) : (
              <div
                className="rounded-sm"
                style={{
                  flex: 1,
                  maxWidth: "120px",
                  height: "8px",
                  backgroundColor: "var(--border)",
                  display: "flex",
                  overflow: "hidden",
                }}
              >
                <div
                  className="rounded-sm"
                  style={{
                    width: `${(bar.value / 10) * 100}%`,
                    height: "100%",
                    backgroundColor: catColor,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", margin: "20px 0" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {specs.map((spec) => (
          <div key={spec.key} className="flex text-xs">
            <span
              className="tracking-wider uppercase"
              style={{ color: "var(--text-mute)", minWidth: "90px" }}
            >
              {spec.key}
            </span>
            <span style={{ color: "var(--text)" }}>{spec.value}</span>
          </div>
        ))}
      </div>

      <p
        className="text-sm leading-relaxed"
        style={{ color: "var(--text-dim)", marginTop: "16px", minHeight: "3rem" }}
      >
        {copy}
      </p>

      <button
        disabled={disabled}
        className="iris-cta w-full rounded-sm text-xs tracking-[0.25em] uppercase"
        style={{
          border: `1px solid ${catColor}`,
          color: disabled ? "var(--text-mute)" : catColor,
          backgroundColor: "transparent",
          padding: "10px 20px",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          marginTop: "20px",
          transition: "background-color 150ms ease",
        }}
      >
        {cta}
      </button>
    </div>
  );

  if (disabled || href === "#") {
    return <div className="flex">{inner}</div>;
  }
  return (
    <Link href={href} className="flex">
      {inner}
    </Link>
  );
}
