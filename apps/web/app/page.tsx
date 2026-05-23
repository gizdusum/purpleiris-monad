import Link from "next/link";
import dynamic from "next/dynamic";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
export const metadata: Metadata = {
  title: "PurpleIris — Monad Validator Intelligence",
};

const IrisBackdrop = dynamic(() => import("@/components/IrisBackdrop"), { ssr: false });
const HeroSection = dynamic(() => import("@/components/HeroSection"), {
  ssr: false,
  loading: () => <div style={{ height: "100vh" }} />,
});
const HermesStepper = dynamic(() => import("@/components/HermesStepper"), { ssr: false });

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
          <Link href="/status" className="iris-nav-link">
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

      {/* Scroll-reveal stepper — What Hermes does / roadmap */}
      <HermesStepper />

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
