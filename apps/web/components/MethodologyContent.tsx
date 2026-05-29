"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

// ── Class colour constants — all on-theme purple family, no green/blue/amber
const C1 = "var(--cat-casual)"; // #c4b5ff — lightest lavender  (Class 1: on-chain)
const C2 = "var(--accent-hover)"; // #9b80ff — medium purple      (Class 2: derived)
const C3 = "var(--accent)"; // #7c5cff — deepest accent     (Class 3: estimated)

/* ── Scroll-reveal wrapper ── */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduced = useReducedMotion() ?? false;
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ── Divider ── */
function Divider() {
  return <div style={{ borderTop: "1px solid var(--border)", margin: "64px 0" }} />;
}

/* ── Section category label ── */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: "var(--text-mute)",
        fontSize: "0.65rem",
        letterSpacing: "0.25em",
        textTransform: "uppercase",
        fontWeight: 600,
        marginBottom: "14px",
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      {children}
    </p>
  );
}

/* ── Monospace formula / address block ── */
function Code({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "var(--bg-elev-2)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        padding: "14px 18px",
        fontFamily: "var(--font-mono), monospace",
        fontSize: "0.875rem",
        color: "var(--text)",
        letterSpacing: "0.03em",
        overflowX: "auto",
        marginTop: "10px",
        marginBottom: "4px",
      }}
    >
      {children}
    </div>
  );
}

/* ── Section with coloured top-border (mirrors mode-card pattern) ── */
function ClassSection({
  cls,
  color,
  title,
  subtitle,
  children,
}: {
  cls: string;
  color: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--bg-elev)",
        border: "1px solid var(--border)",
        borderTopColor: color,
        borderTopWidth: "2px",
        borderRadius: "6px",
        padding: "28px",
      }}
    >
      <p
        style={{
          color,
          fontSize: "0.65rem",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          fontWeight: 600,
          marginBottom: "8px",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {cls}
      </p>
      <h2
        style={{
          color: "var(--text)",
          fontSize: "1.375rem",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          marginBottom: "6px",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          color: "var(--text-dim)",
          fontSize: "0.875rem",
          lineHeight: "1.7",
          marginBottom: "24px",
          maxWidth: "560px",
        }}
      >
        {subtitle}
      </p>
      {children}
    </div>
  );
}

/* ── Sub-heading within a section ── */
function Sub({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        color: "var(--text)",
        fontSize: "0.78rem",
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        marginTop: "28px",
        marginBottom: "10px",
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      {children}
    </h3>
  );
}

/* ── Body text ── */
function Body({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: "var(--text-dim)",
        fontSize: "0.875rem",
        lineHeight: "1.75",
        marginBottom: "8px",
      }}
    >
      {children}
    </p>
  );
}

/* ── Bullet list ── */
function Bullets({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "7px",
      }}
    >
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            display: "flex",
            gap: "12px",
            color: "var(--text-dim)",
            fontSize: "0.875rem",
            lineHeight: "1.65",
          }}
        >
          <span style={{ color: "var(--border-hover)", flexShrink: 0 }}>·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Tool row ── */
function ToolRow({ name, desc }: { name: string; desc: string }) {
  return (
    <div
      className="grid grid-cols-1 gap-1 md:grid-cols-[210px_1fr] md:gap-4"
      style={{
        paddingTop: "10px",
        paddingBottom: "10px",
        borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
        alignItems: "start",
      }}
    >
      <code
        style={{
          color: "var(--accent)",
          fontFamily: "var(--font-mono), monospace",
          fontSize: "0.78rem",
        }}
      >
        {name}
      </code>
      <span style={{ color: "var(--text-dim)", fontSize: "0.8rem", lineHeight: "1.6" }}>
        {desc}
      </span>
    </div>
  );
}

/* ── Inline code span ── */
function IC({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        color: "var(--accent)",
        fontFamily: "var(--font-mono), monospace",
        fontSize: "0.85em",
      }}
    >
      {children}
    </code>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main export
═══════════════════════════════════════════════════════════════ */
export default function MethodologyContent() {
  return (
    <>
      {/* ── Fixed header — mirrors homepage exactly ── */}
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
          <span
            style={{
              color: "var(--accent)",
              fontWeight: 600,
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            DOCS
          </span>
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

      {/* ── Main content ── */}
      <main
        style={{
          paddingTop: "96px",
          paddingBottom: "80px",
          paddingLeft: "24px",
          paddingRight: "24px",
        }}
      >
        <div style={{ maxWidth: "820px", margin: "0 auto" }}>
          {/* ─── SECTION 1: Intro ─── */}
          <Reveal>
            <Label>Hermes Methodology</Label>
            <h1
              style={{
                color: "var(--text)",
                fontSize: "clamp(1.875rem, 5vw, 3rem)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginBottom: "20px",
              }}
            >
              How Hermes sources
              <br />
              and classifies data
            </h1>
            <p
              style={{
                color: "var(--text-dim)",
                fontSize: "1rem",
                lineHeight: "1.75",
                maxWidth: "600px",
                marginBottom: "12px",
              }}
            >
              Hermes is a Monad validator intelligence assistant. Every factual claim it returns
              carries a <strong style={{ color: "var(--text)" }}>data-class label</strong> so you
              can immediately judge its reliability — whether it came directly from the chain, was
              computed by a stated formula, or involves an approximation with explicit caveats.
            </p>
            <p
              style={{
                color: "var(--text-dim)",
                fontSize: "0.9rem",
                lineHeight: "1.75",
                maxWidth: "600px",
              }}
            >
              Hermes is <strong style={{ color: "var(--text)" }}>non-advisory</strong>: it surfaces
              data and analysis, never tells you what to do. Two modes:
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap" }}>
              {[
                { label: "Delegator", color: C1, desc: "Conversational discovery + comparison" },
                { label: "Operator", color: C3, desc: "Diagnostics + earnings" },
              ].map(({ label, color, desc }) => (
                <div
                  key={label}
                  style={{
                    border: `1px solid ${color}`,
                    borderRadius: "6px",
                    padding: "10px 16px",
                  }}
                >
                  <p
                    style={{
                      color,
                      fontSize: "0.65rem",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      marginBottom: "4px",
                    }}
                  >
                    {label}
                  </p>
                  <p style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>{desc}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Divider />

          {/* ─── SECTION 2: Data-class overview ─── */}
          <Reveal>
            <Label>Data-class system</Label>
            <h2
              style={{
                color: "var(--text)",
                fontSize: "1.5rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                marginBottom: "8px",
              }}
            >
              Three classes, always labeled
            </h2>
            <p
              style={{
                color: "var(--text-dim)",
                fontSize: "0.875rem",
                lineHeight: "1.75",
                maxWidth: "580px",
                marginBottom: "28px",
              }}
            >
              Every number in a Hermes response is tagged inline. You always know the epistemic
              status of what you're reading before you act on it.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                {
                  color: C1,
                  cls: "Class 1",
                  title: "On-chain",
                  body: "Read directly from the Monad staking precompile or chain state. Deterministic — no formula applied.",
                },
                {
                  color: C2,
                  cls: "Class 2",
                  title: "Derived",
                  body: "Computed from on-chain inputs via a versioned, stated formula. Reproducible given the same inputs.",
                },
                {
                  color: C3,
                  cls: "Class 3",
                  title: "Estimated",
                  body: "Projections involving approximations. Always paired with a low/base/high range and a known-weakness statement.",
                },
              ].map(({ color, cls, title, body }) => (
                <div
                  key={cls}
                  style={{
                    backgroundColor: "var(--bg-elev)",
                    border: "1px solid var(--border)",
                    borderTopColor: color,
                    borderTopWidth: "2px",
                    borderRadius: "6px",
                    padding: "20px",
                  }}
                >
                  <p
                    style={{
                      color,
                      fontSize: "0.65rem",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      fontWeight: 600,
                      marginBottom: "8px",
                      fontFamily: "var(--font-mono), monospace",
                    }}
                  >
                    {cls}
                  </p>
                  <p
                    style={{
                      color: "var(--text)",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      marginBottom: "8px",
                    }}
                  >
                    {title}
                  </p>
                  <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", lineHeight: "1.65" }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>

          <Divider />

          {/* ─── SECTION 3: Class 1 ─── */}
          <Reveal>
            <ClassSection
              cls="Class 1"
              color={C1}
              title="On-chain (deterministic)"
              subtitle="Read directly from Monad or the staking precompile. No formula applied. Results are deterministic — anyone querying the same block gets the same answer."
            >
              <Bullets
                items={[
                  "Stake amounts — total delegated MON per validator",
                  "Commission rate — in basis points (e.g. 500 = 5%)",
                  "Jail status and active / inactive status",
                  "Block counts — proposed and missed, per epoch",
                  "Delegator count and voting power",
                  "Pending unclaimed commission — live balance, resets on claim",
                  "Cumulative staking rewards — indexed from on-chain proposer-reward events",
                  "Execution revenue — per-block transaction fee income, indexed on-chain",
                ]}
              />

              <Sub>Staking rewards — two layers</Sub>
              <Body>
                <strong style={{ color: "var(--text)" }}>Layer 1 — live pending commission.</strong>{" "}
                Read from <IC>getValidator()</IC> on the Monad staking precompile:
              </Body>
              <Code>0x0000000000000000000000000000000000001000</Code>
              <p
                style={{
                  color: "var(--text-mute)",
                  fontSize: "0.78rem",
                  marginTop: "6px",
                  marginBottom: "16px",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                Returns <IC>unclaimedRewards</IC> — the live pending balance, resets to zero when
                the validator claims.
              </p>
              <Body>
                <strong style={{ color: "var(--text)" }}>Layer 2 — cumulative history.</strong>{" "}
                Indexed from per-block proposer-reward events (topic <IC>0x3a420a01</IC>),
                aggregated daily. Commission earned per block = gross block reward × the
                validator&apos;s commission rate.
              </Body>

              <Sub>Execution revenue</Sub>
              <Body>
                Per-block transaction / priority fee income. Indexed on-chain and reported over
                7-day and 24-hour windows with a daily breakdown, trend direction (up / flat /
                down), and rank versus the network median.
              </Body>
            </ClassSection>
          </Reveal>

          <Divider />

          {/* ─── SECTION 4: Class 2 ─── */}
          <Reveal>
            <ClassSection
              cls="Class 2"
              color={C2}
              title="Derived (formula-labeled)"
              subtitle="Computed from on-chain inputs using stated formulas. Each formula carries a version label so results are reproducible and changes are traceable."
            >
              <Sub>Shannon entropy — stake and diversification</Sub>
              <Body>
                Used to score delegation spread across validators, geographic regions, and
                infrastructure providers. Applied in diversification simulations.
              </Body>
              <Code>H = −Σ pᵢ · log₂(pᵢ)</Code>
              <p
                style={{
                  color: "var(--text-dim)",
                  fontSize: "0.8rem",
                  lineHeight: "1.7",
                  marginTop: "10px",
                }}
              >
                p<sub>i</sub> = stake share of each validator / region / infra bucket. Normalized
                0–1 against the theoretical maximum (uniform distribution). Labeled{" "}
                <IC>formula v1.0</IC>.
              </p>

              <Sub>Nakamoto coefficient</Sub>
              <Body>
                Minimum number of validators that together control more than 33% of total stake —
                the standard fault-tolerance threshold. Computed from live stake distribution on
                every query. Labeled <IC>nakamoto_coefficient v1.0</IC>.
              </Body>

              <Sub>30-day success rate</Sub>
              <Body>
                Block success rate over a rolling 30-day window, with epochs flagged as scheduled
                downtime excluded from the denominator:
              </Body>
              <Code>success_rate = blocks_proposed / (blocks_proposed + blocks_missed)</Code>
              <p
                style={{
                  color: "var(--text-dim)",
                  fontSize: "0.8rem",
                  lineHeight: "1.7",
                  marginTop: "10px",
                }}
              >
                Requires approximately 30 days of accumulated epoch snapshots to be fully populated.
                When the indexer window is shorter, Hermes flags the metric as partial rather than
                returning an incomplete average silently.
              </p>

              <Sub>Validator health score</Sub>
              <Body>
                A composite per-validator signal surfaced in <IC>get_validator</IC> output, derived
                from commission rate and 30-day block success rate. It is one of several signals in
                the full validator profile — not a standalone public rating with a separate name.
              </Body>
            </ClassSection>
          </Reveal>

          <Divider />

          {/* ─── SECTION 5: Class 3 ─── */}
          <Reveal>
            <ClassSection
              cls="Class 3"
              color={C3}
              title="Estimated (uncertainty-aware)"
              subtitle="Projections and approximations. Always includes a low / base / high range and an explicit known-weakness statement. Not financial advice."
            >
              <Sub>Projected APY</Sub>
              <Body>A three-point range (low / base / high) computed from:</Body>
              <Code>APY ≈ network_reward_rate × (1 − commission_rate) × ±variance</Code>
              <p
                style={{
                  color: "var(--text-dim)",
                  fontSize: "0.8rem",
                  lineHeight: "1.7",
                  marginTop: "10px",
                }}
              >
                <strong style={{ color: "var(--text)" }}>Known weakness:</strong> the network reward
                rate is approximated, not read directly from chain. Actual rewards vary with total
                network participation and validator commission changes.
              </p>

              <Sub>Reward simulations</Sub>
              <Body>
                Estimated MON earned for a given stake amount, duration in days, and validator
                commission rate. Monthly extrapolations are derived from a 7-day rolling average.
                Always labeled Class 3 with the known weakness cited.
              </Body>

              <Sub>Region and infrastructure provider</Sub>
              <Body>
                Region and infrastructure provider fields are{" "}
                <strong style={{ color: "var(--text)" }}>self-reported by validators</strong> in the
                Monad community registry (
                <a
                  href="https://github.com/monad-developers/validator-info"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="iris-nav-link"
                >
                  github.com/monad-developers/validator-info
                </a>
                ). Hermes does not infer location from IP addresses or ASN data. Values reflect what
                each operator has declared in the registry — unverified and Class 3.
              </Body>
            </ClassSection>
          </Reveal>

          <Divider />

          {/* ─── SECTION 6: Tools ─── */}
          <Reveal>
            <Label>Tool reference</Label>
            <h2
              style={{
                color: "var(--text)",
                fontSize: "1.5rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                marginBottom: "8px",
              }}
            >
              What PurpleIris can actually do
            </h2>
            <p
              style={{
                color: "var(--text-dim)",
                fontSize: "0.875rem",
                lineHeight: "1.75",
                maxWidth: "560px",
                marginBottom: "32px",
              }}
            >
              14 tools total. Delegator mode has 10; Operator mode extends that with 4 diagnostics
              and earnings tools.
            </p>

            <p
              style={{
                color: "var(--text-mute)",
                fontSize: "0.65rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginBottom: "4px",
                fontFamily: "var(--font-mono), monospace",
              }}
            >
              Delegator — 10 tools
            </p>
            <div style={{ marginBottom: "32px" }}>
              {[
                {
                  name: "get_validator",
                  desc: "Full validator profile: commission, stake, jail status, 7d/30d block metrics, health score",
                },
                {
                  name: "list_validators",
                  desc: "Filterable validator list — commission cap, min stake, region, infra provider, active-only, limit",
                },
                {
                  name: "find_underdogs",
                  desc: "High success-rate / low-stake-rank validators; ranked by 30-day average success rate",
                },
                {
                  name: "simulate_delegation",
                  desc: "Class 3 APY range + estimated MON reward for N MON staked with a validator over N days",
                },
                {
                  name: "simulate_diversification",
                  desc: "Class 2 Shannon entropy scores for a proposed multi-validator stake split",
                },
                {
                  name: "estimate_stake_reward",
                  desc: "Quick reward estimate from commission rate, stake amount, and duration — no DB query",
                },
                {
                  name: "get_recent_assignments",
                  desc: "Last N epoch round-assignment records for a validator",
                },
                {
                  name: "get_network_health",
                  desc: "Active validator count, total stake, Nakamoto coefficient, network-wide success rate",
                },
                {
                  name: "get_network_overview",
                  desc: "Epoch, Watchtower uptime, 30d aggregates, alert distribution, top validators by uptime",
                },
                {
                  name: "get_latest_monad_release",
                  desc: "Latest Monad protocol release tag, date, and summary — synced from GitHub",
                },
              ].map((t) => (
                <ToolRow key={t.name} {...t} />
              ))}
            </div>

            <p
              style={{
                color: "var(--text-mute)",
                fontSize: "0.65rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginBottom: "4px",
                fontFamily: "var(--font-mono), monospace",
              }}
            >
              Operator adds — 4 tools
            </p>
            <div>
              {[
                {
                  name: "get_staking_rewards",
                  desc: "Pending unclaimed commission + cumulative 7d/24h staking commission history (Class 1)",
                },
                {
                  name: "get_execution_revenue",
                  desc: "7d + 24h block priority fee income; daily breakdown, trend, rank vs network median (Class 1)",
                },
                {
                  name: "get_assignment_predictor",
                  desc: "Expected vs actual round assignment frequency based on stake ratio; flags below / above expected",
                },
                {
                  name: "get_anomaly_check",
                  desc: "Scans a look-back window for operational anomalies: timeout clusters, rate drops, streak breaks, extended offline periods",
                },
              ].map((t) => (
                <ToolRow key={t.name} {...t} />
              ))}
            </div>
          </Reveal>

          <Divider />

          {/* ─── SECTION 7: Data pipeline & honesty ─── */}
          <Reveal>
            <Label>Data pipeline</Label>
            <h2
              style={{
                color: "var(--text)",
                fontSize: "1.5rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                marginBottom: "8px",
              }}
            >
              Honesty about data windows
            </h2>
            <p
              style={{
                color: "var(--text-dim)",
                fontSize: "0.875rem",
                lineHeight: "1.75",
                maxWidth: "580px",
                marginBottom: "14px",
              }}
            >
              Hermes indexes Monad mainnet continuously into a relational database. Time-windowed
              metrics — 7-day staking history, 30-day success rate — fill in as the indexer
              accumulates data. When a window is not yet fully populated, Hermes says so rather than
              returning an incomplete value silently or fabricating completeness.
            </p>
            <p
              style={{
                color: "var(--text-dim)",
                fontSize: "0.875rem",
                lineHeight: "1.75",
                maxWidth: "580px",
              }}
            >
              All data that Hermes returns is read-only. It observes chain state; it does not submit
              transactions, hold keys, or take any on-chain action.
            </p>
            <div
              style={{
                marginTop: "24px",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                padding: "20px 24px",
                backgroundColor: "var(--bg-elev)",
              }}
            >
              <p style={{ color: "var(--text-dim)", fontSize: "0.875rem", lineHeight: "1.75" }}>
                Spotted incorrect data or unexpected behaviour?{" "}
                <Link
                  href="/transparency/new"
                  className="iris-nav-link"
                  style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}
                >
                  Submit feedback →
                </Link>
              </p>
            </div>
          </Reveal>
        </div>
      </main>

      {/* ── Footer — exact copy from homepage ── */}
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
