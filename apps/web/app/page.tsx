import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PurpleIris — Monad Validator Intelligence",
};

const modes = [
  {
    id: "user",
    href: "/chat/delegator",
    emoji: "👤",
    label: "Delegator",
    subtitle: "Ask Iris anything about validators",
    description:
      "Commission rates, block production, diversification scores, reward projections — all cited with source and data class.",
    badge: null as string | null,
    cta: "Open Iris",
    available: true,
  },
  {
    id: "validator",
    href: "#",
    emoji: "🖥",
    label: "Operator",
    subtitle: "Your node health at a glance",
    description:
      "CPU / memory telemetry, consensus lag, peer count, and incident summaries streamed directly from your node.",
    badge: "Coming soon" as string | null,
    cta: "Coming soon",
    available: false,
  },
  {
    id: "stake",
    href: "#",
    emoji: "💜",
    label: "Stake Sim",
    subtitle: "Model delegation scenarios",
    description:
      "ERC-4626 vault simulation on Monad testnet. Explore automated restaking strategies before committing mainnet MON.",
    badge: "Testnet beta" as string | null,
    cta: "Testnet only",
    available: false,
  },
];

export default function HomePage() {
  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pt-24 pb-12 text-center">
        <p className="text-iris-primary mb-3 text-sm font-semibold tracking-widest uppercase">
          Monad Validator Intelligence
        </p>
        <h1 className="font-heading text-foreground mb-4 text-5xl leading-tight font-bold md:text-6xl">
          The open eye on Monad
        </h1>
        <p className="text-muted-foreground mx-auto max-w-xl text-lg">
          Iris reads on-chain data so you don&apos;t have to. Every number cited, every claim
          classified.
        </p>
      </div>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 px-6 pb-24 md:grid-cols-3">
        {modes.map((mode) => (
          <ModeCard key={mode.id} {...mode} />
        ))}
      </div>

      <div className="border-border border-t">
        <div className="mx-auto max-w-5xl px-6 py-8 text-center">
          <p className="text-muted-foreground text-sm">
            All Iris responses carry{" "}
            <span className="text-foreground font-medium">data-class labels</span>:{" "}
            <span className="text-iris-primary">Class 1</span> on-chain ·{" "}
            <span className="text-iris-primary">Class 2</span> derived ·{" "}
            <span className="text-iris-primary">Class 3</span> estimated.{" "}
            <Link href="/methodology" className="text-iris-primary underline underline-offset-2">
              Read the methodology
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function ModeCard({
  href,
  emoji,
  label,
  subtitle,
  description,
  badge,
  cta,
  available,
}: (typeof modes)[number]) {
  const inner = (
    <div
      className={[
        "border-border bg-card group flex h-full flex-col rounded-2xl border p-6 transition-all duration-200",
        available
          ? "hover:border-iris-primary hover:shadow-iris-primary/10 cursor-pointer hover:shadow-lg"
          : "opacity-60",
      ].join(" ")}
    >
      <div className="mb-4 flex items-start justify-between">
        <span className="text-3xl">{emoji}</span>
        {badge && (
          <span
            className={[
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              badge === "Testnet beta"
                ? "bg-amber-100 text-amber-700"
                : "bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {badge}
          </span>
        )}
      </div>
      <h2 className="font-heading text-foreground mb-1 text-xl font-bold">{label}</h2>
      <p className="text-iris-primary mb-3 text-sm font-medium">{subtitle}</p>
      <p className="text-muted-foreground mb-6 flex-1 text-sm leading-relaxed">{description}</p>
      <span
        className={[
          "mt-auto inline-block rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors",
          available
            ? "bg-iris-primary text-primary-foreground group-hover:bg-iris-primary/90"
            : "bg-muted text-muted-foreground",
        ].join(" ")}
      >
        {cta}
      </span>
    </div>
  );

  if (!available) return <div>{inner}</div>;
  return <Link href={href}>{inner}</Link>;
}
