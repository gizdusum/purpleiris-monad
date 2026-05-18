import Link from "next/link";
import type { Metadata } from "next";
import type { CSSProperties } from "react";

export const metadata: Metadata = {
  title: "PurpleIris — Monad Validator Intelligence",
};

type Bar = { label: string; value: number | null };
type Spec = { key: string; value: string };

type CardDef = {
  id: string;
  category: string;
  catColor: string;
  hoverBg: string;
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
    hoverBg: "rgba(167, 139, 250, 0.1)",
    name: "DELEGATOR",
    bars: [
      { label: "READINESS", value: 8 },
      { label: "DEPTH", value: 6 },
      { label: "LATENCY", value: 9 },
    ],
    specs: [
      { key: "MODE:", value: "conversational" },
      { key: "OUTPUT:", value: "validator lists" },
      { key: "BOUNDARY:", value: "non-advisory" },
    ],
    copy: "Ask anything about Monad staking. Get validator data, not advice.",
    cta: "ENTER →",
    href: "/chat/delegator",
    disabled: false,
  },
  {
    id: "operator",
    category: "OPERATOR",
    catColor: "var(--cat-operator)",
    hoverBg: "rgba(91, 76, 196, 0.1)",
    name: "OPERATOR",
    bars: [
      { label: "READINESS", value: 10 },
      { label: "DEPTH", value: 10 },
      { label: "LATENCY", value: 8 },
    ],
    specs: [
      { key: "MODE:", value: "technical" },
      { key: "OUTPUT:", value: "metrics + commands" },
      { key: "ACCESS:", value: "read-only" },
    ],
    copy: "Run validator diagnostics. Inspect performance, commission, uptime.",
    cta: "ENTER →",
    href: "#",
    disabled: false,
  },
  {
    id: "stake-sim",
    category: "FORECAST",
    catColor: "var(--cat-forecast)",
    hoverBg: "rgba(59, 59, 107, 0.1)",
    name: "STAKE SIM",
    bars: [
      { label: "READINESS", value: 0 },
      { label: "DEPTH", value: 10 },
      { label: "LATENCY", value: null },
    ],
    specs: [
      { key: "MODE:", value: "forecast" },
      { key: "STATUS:", value: "coming soon" },
      { key: "RELEASE:", value: "v1.x" },
    ],
    copy: "Project your rewards across scenarios. Not yet live.",
    cta: "COMING SOON",
    href: "#",
    disabled: true,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid var(--iris-border)" }}
      >
        <span className="text-sm tracking-wider uppercase">
          <span style={{ color: "var(--iris-accent)" }}>|</span>
          <span style={{ color: "var(--text)" }}>PURPLEIRIS</span>
        </span>
        <nav className="flex items-center gap-1 text-xs tracking-wider uppercase">
          <Link href="/methodology" className="iris-nav-link">
            DOCS
          </Link>
          <span className="mx-1" style={{ color: "var(--text-dim)" }}>
            ·
          </span>
          <a
            href="https://github.com/gizdusum/purpleiris"
            target="_blank"
            rel="noopener noreferrer"
            className="iris-nav-link"
          >
            GITHUB
          </a>
          <span className="mx-1" style={{ color: "var(--text-dim)" }}>
            ·
          </span>
          <Link href="/api/health" className="iris-nav-link">
            STATUS
          </Link>
        </nav>
      </header>

      {/* Hero stat strip */}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 py-5 text-xs tracking-wider uppercase"
        style={{ borderBottom: "1px solid var(--iris-border)", color: "var(--text-dim)" }}
      >
        <span>3 MODES</span>
        <span>·</span>
        <span>202 VALIDATORS</span>
        <span>·</span>
        <span>MONAD MAINNET NETWORK</span>
        <span>·</span>
        <span>CLAUDE SONNET 4.6 POWERED BY</span>
        <span>·</span>
        <span>CLASS 1/2/3 DATA MODEL</span>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-4 px-6 py-8 md:grid-cols-3 md:gap-6">
        {cards.map((card) => (
          <ModeCard key={card.id} card={card} />
        ))}
      </div>

      {/* Footer */}
      <footer className="px-6 py-6" style={{ borderTop: "1px solid var(--iris-border)" }}>
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs tracking-wider uppercase">
          <p style={{ color: "var(--text-dim)" }}>
            ALL RESPONSES CARRY DATA-CLASS LABELS ·{" "}
            <Link href="/methodology" style={{ color: "var(--iris-accent)" }}>
              READ THE METHODOLOGY
            </Link>
          </p>
          <span
            className="rounded-sm"
            style={{
              border: "1px solid var(--iris-accent)",
              color: "var(--iris-accent)",
              padding: "4px 10px",
            }}
          >
            v1.0 · Iris
          </span>
        </div>
      </footer>
    </main>
  );
}

function ModeCard({ card }: { card: CardDef }) {
  const { category, catColor, hoverBg, name, bars, specs, copy, cta, href, disabled } = card;

  const cardStyle: CSSProperties = {
    backgroundColor: "var(--bg-elev)",
    borderTop: `3px solid ${catColor}`,
    borderRight: "1px solid var(--iris-border)",
    borderBottom: "1px solid var(--iris-border)",
    borderLeft: "1px solid var(--iris-border)",
  };

  const ctaStyle = {
    border: `1px solid ${catColor}`,
    color: disabled ? "var(--text-dim)" : catColor,
    backgroundColor: "transparent",
    padding: "8px 16px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    "--cta-hover-bg": hoverBg,
  } as CSSProperties;

  const inner = (
    <div style={cardStyle} className="flex h-full flex-col rounded-sm p-6 md:p-8">
      {/* Category label */}
      <p className="mb-3 text-xs tracking-wider uppercase" style={{ color: catColor }}>
        {category}
      </p>

      {/* Card name */}
      <h2 className="mb-4 text-3xl font-bold uppercase" style={{ color: "var(--text)" }}>
        {name}
      </h2>

      {/* Separator */}
      <div className="mb-4" style={{ borderTop: "1px solid var(--iris-border)" }} />

      {/* Progress bars */}
      <div className="mb-4 flex flex-col gap-2">
        {bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3">
            <span
              className="text-xs tracking-wider uppercase"
              style={{ color: "var(--text-dim)", minWidth: "80px" }}
            >
              {bar.label}
            </span>
            {bar.value === null ? (
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                —
              </span>
            ) : (
              <div className="flex h-2 w-24 overflow-hidden rounded-sm">
                <div
                  style={{
                    width: `${(bar.value / 10) * 100}%`,
                    backgroundColor: catColor,
                  }}
                />
                <div style={{ flex: 1, backgroundColor: "var(--iris-border)" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Separator */}
      <div className="mb-4" style={{ borderTop: "1px solid var(--iris-border)" }} />

      {/* Spec lines */}
      <div className="mb-4 flex flex-col gap-1.5">
        {specs.map((spec) => (
          <div key={spec.key} className="flex text-xs">
            <span
              className="tracking-wider uppercase"
              style={{ color: "var(--text-dim)", minWidth: "90px" }}
            >
              {spec.key}
            </span>
            <span style={{ color: "var(--text)" }}>{spec.value}</span>
          </div>
        ))}
      </div>

      {/* Marketing copy */}
      <p className="mb-6 flex-1 text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
        {copy}
      </p>

      {/* CTA */}
      <button
        disabled={disabled}
        style={ctaStyle}
        className="iris-cta mt-auto self-start rounded-sm text-xs tracking-wider uppercase"
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
