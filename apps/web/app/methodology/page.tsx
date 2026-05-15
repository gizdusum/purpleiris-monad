import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How PurpleIris classifies and sources its data.",
};

export default function MethodologyPage() {
  return (
    <main className="bg-background min-h-screen px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-8 inline-block text-sm"
        >
          ← Back
        </Link>
        <h1 className="font-heading text-foreground mb-4 text-4xl font-bold">Methodology</h1>
        <p className="text-muted-foreground mb-8">
          Every factual claim in an Iris response carries a data-class label so you can assess its
          reliability.
        </p>

        <div className="space-y-6">
          <DataClassCard
            label="Class 1 — On-chain (deterministic)"
            color="text-green-600"
            examples={[
              "Stake amounts",
              "Commission rates",
              "Jail status",
              "Block counts",
              "Delegator counts",
              "Voting power",
            ]}
            note="Read directly from the Monad staking precompile at 0x0000…1000. No formula applied."
          />
          <DataClassCard
            label="Class 2 — Derived (formula-dependent)"
            color="text-blue-600"
            examples={[
              "OVR Score (v1.0)",
              "Shannon entropy diversity scores",
              "Nakamoto coefficient",
              "Reliability / uptime scores",
              "30-day success rate (excludes scheduled downtime)",
            ]}
            note="Computed from Class 1 inputs using a pinned formula version. Formula changes increment the version."
          />
          <DataClassCard
            label="Class 3 — Estimated (uncertainty-aware)"
            color="text-amber-600"
            examples={[
              "Projected APY",
              "Reward projections",
              "Slashing probability",
              "Geographic location inference",
              "Infrastructure provider inference",
            ]}
            note="Includes a confidence interval or range and an explicit known weakness statement. Not financial advice."
          />
        </div>

        <div className="border-border mt-10 rounded-xl border p-5">
          <p className="text-muted-foreground text-sm">
            See something wrong?{" "}
            <Link
              href="/transparency/new"
              className="text-iris-primary underline underline-offset-2"
            >
              Submit a dispute ticket
            </Link>{" "}
            and Iris will re-run the query with full tool-call traces attached.
          </p>
        </div>
      </div>
    </main>
  );
}

function DataClassCard({
  label,
  color,
  examples,
  note,
}: {
  label: string;
  color: string;
  examples: string[];
  note: string;
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-5">
      <h2 className={`font-heading mb-3 text-lg font-bold ${color}`}>{label}</h2>
      <ul className="text-muted-foreground mb-3 space-y-1 text-sm">
        {examples.map((e) => (
          <li key={e} className="flex gap-2">
            <span className="shrink-0 opacity-50">·</span>
            <span>{e}</span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground border-border border-t pt-3 text-xs">{note}</p>
    </div>
  );
}
