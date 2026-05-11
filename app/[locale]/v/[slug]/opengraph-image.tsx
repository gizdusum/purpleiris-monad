import { ImageResponse } from "next/og";
import { getWatchtowerOverview } from "@/lib/monad/watchtower";
import { toSlug } from "@/lib/monad/slug";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function computeScore(uptime: number, vdpFlags: number, alertLevel: number, consecSkipped: number) {
  const vdpPenalty = Math.min(vdpFlags * 2, 20);
  const alertPenalty = alertLevel * 5;
  const skipPenalty = Math.min(consecSkipped * 2, 10);
  return Math.round(Math.max(50, Math.min(99, uptime - vdpPenalty - alertPenalty - skipPenalty)));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  let score = 0;
  let uptime = "—";
  let vdpClean = true;

  try {
    const overview = await getWatchtowerOverview();
    const v = overview.validators.find((v) => toSlug(v.name) === slug);
    if (v) {
      name = v.name;
      score = computeScore(
        v.uptime_percentage,
        v.vdp_flagged_weeks,
        v.alert_level,
        v.consecutive_skipped
      );
      uptime = `${v.uptime_percentage.toFixed(1)}%`;
      vdpClean = v.vdp_flagged_weeks === 0;
    }
  } catch {
    // use defaults
  }

  const tier = score >= 95 ? "ELITE" : score >= 85 ? "PRO" : score >= 75 ? "RELIABLE" : "STANDARD";
  const tierColor =
    tier === "ELITE"
      ? "#f59e0b"
      : tier === "PRO"
        ? "#cbd5e1"
        : tier === "RELIABLE"
          ? "#fb923c"
          : "#94a3b8";

  return new ImageResponse(
    <div
      style={{
        background: "linear-gradient(135deg, #0a0015 0%, #12002a 50%, #0a0015 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 500,
          height: 500,
          background: "radial-gradient(circle, rgba(109,40,217,0.3) 0%, transparent 70%)",
        }}
      />

      {/* PurpleIris logo text */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "oklch(0.62 0.26 291)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "oklch(0.80 0.14 291)",
            }}
          />
        </div>
        <span style={{ color: "#a78bfa", fontSize: 20, fontWeight: 600 }}>PurpleIris</span>
      </div>

      {/* Validator name */}
      <div
        style={{
          color: "#ffffff",
          fontSize: 56,
          fontWeight: 900,
          lineHeight: 1.1,
          marginBottom: 16,
        }}
      >
        {name}
      </div>

      {/* Tier badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: `${tierColor}22`,
          border: `1px solid ${tierColor}55`,
          borderRadius: 100,
          padding: "6px 16px",
          marginBottom: 48,
          width: "fit-content",
        }}
      >
        <span style={{ color: tierColor, fontSize: 14, fontWeight: 700, letterSpacing: 3 }}>
          {tier}
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 48, alignItems: "flex-end" }}>
        <div>
          <div style={{ color: tierColor, fontSize: 100, fontWeight: 900, lineHeight: 1 }}>
            {score}
          </div>
          <div style={{ color: "#64748b", fontSize: 18, fontWeight: 700, letterSpacing: 4 }}>
            OVR SCORE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <StatItem label="UPTIME" value={uptime} positive />
          <StatItem label="VDP" value={vdpClean ? "Clean ✓" : "Flagged"} positive={vdpClean} />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          right: 80,
          color: "#4c1d95",
          fontSize: 14,
        }}
      >
        purpleiris.live
      </div>
    </div>,
    { ...size }
  );
}

function StatItem({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600, letterSpacing: 2 }}>
        {label}
      </span>
      <span style={{ color: positive ? "#34d399" : "#f87171", fontSize: 22, fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}
