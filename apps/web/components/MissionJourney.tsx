"use client";

import type { CSSProperties } from "react";

const OK = "#5ce0a8";
const ACC2 = "#9b80ff";

type StopDef = {
  ver: string;
  name: string;
  desc: string;
  badge: string;
  badgeKind: "live" | "next" | "future";
  reached: boolean;
  dot: string;
  stamp?: string;
  glyph?: string;
};

const STOPS: StopDef[] = [
  {
    ver: "v1.0 · REACHED",
    name: "HERMES",
    desc: "The messenger arrived first — validator intelligence, live on Monad mainnet. You're talking to it now.",
    badge: "● Live",
    badgeKind: "live",
    reached: true,
    dot: "✓",
    stamp: "01",
  },
  {
    ver: "v1.1",
    name: "ATHENA",
    desc: "She sees what the numbers won't say. Soon. ▍",
    badge: "On the path",
    badgeKind: "next",
    reached: false,
    dot: "2",
    glyph: "▚▟ ▖▜",
  },
  {
    ver: "v1.2",
    name: "ARGUS",
    desc: "A hundred eyes that never close. Watching — before you need to.",
    badge: "Approaching",
    badgeKind: "future",
    reached: false,
    dot: "3",
    glyph: "▟▖ ▜▚",
  },
  {
    ver: "v1.3",
    name: "MNEMOSYNE",
    desc: "The chain forgets nothing. Neither will she.",
    badge: "Distant",
    badgeKind: "future",
    reached: false,
    dot: "4",
    glyph: "▖▜▟ ▚",
  },
  {
    ver: "v2.0",
    name: "PYTHIA",
    desc: "She speaks of what hasn't happened yet. The horizon is listening.",
    badge: "Horizon",
    badgeKind: "future",
    reached: false,
    dot: "5",
    glyph: "▜ ▖▚▟",
  },
];

const NON_REACHED_OPACITY = [0.62, 0.52, 0.42, 0.34];

function getBadgeStyle(kind: "live" | "next" | "future"): CSSProperties {
  const base: CSSProperties = {
    fontSize: "9px",
    letterSpacing: ".18em",
    padding: "5px 10px",
    borderRadius: "5px",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    fontWeight: 600,
    border: "1px solid",
    flexShrink: 0,
  };
  if (kind === "live")
    return {
      ...base,
      color: OK,
      borderColor: "rgba(92,224,168,.5)",
      background: "rgba(92,224,168,.08)",
    };
  if (kind === "next")
    return {
      ...base,
      color: ACC2,
      borderColor: "rgba(124,92,255,.4)",
      background: "rgba(124,92,255,.06)",
    };
  return { ...base, color: "var(--text-mute)", borderColor: "var(--border)" };
}

export default function MissionJourney() {
  return (
    <div className="mission-journey">
      <div className="mission-rail" aria-hidden="true" />
      {STOPS.map((stop, i) => {
        const cardOpacity = stop.reached ? 1 : (NON_REACHED_OPACITY[i - 1] ?? 0.34);
        return (
          <div key={stop.name} className={`mission-stop${stop.reached ? "reached" : ""}`}>
            <div className="mission-dot">{stop.dot}</div>
            {stop.reached && <div className="mission-ring" aria-hidden="true" />}
            <div className="mission-card" style={{ opacity: cardOpacity }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "10px",
                      letterSpacing: ".2em",
                      color: stop.reached ? OK : ACC2,
                      marginBottom: "2px",
                    }}
                  >
                    {stop.ver}
                  </div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      letterSpacing: ".04em",
                      filter: stop.reached ? undefined : "blur(.3px)",
                    }}
                  >
                    {stop.name}
                  </div>
                  <div
                    style={{
                      fontSize: "12.5px",
                      color: "var(--text-dim)",
                      marginTop: "8px",
                      lineHeight: 1.55,
                      maxWidth: "560px",
                      fontStyle: "italic",
                    }}
                  >
                    {stop.desc}
                  </div>
                </div>
                <span style={getBadgeStyle(stop.badgeKind)}>{stop.badge}</span>
              </div>
              {stop.stamp && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    right: "16px",
                    bottom: "10px",
                    fontSize: "46px",
                    fontWeight: 800,
                    color: "rgba(92,224,168,.06)",
                    letterSpacing: "-.02em",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  {stop.stamp}
                </span>
              )}
              {stop.glyph && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    right: "16px",
                    bottom: "12px",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "rgba(124,92,255,.3)",
                    letterSpacing: "2px",
                  }}
                >
                  {stop.glyph}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
