import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Report an Issue",
  description: "Flag a potentially inaccurate Iris response for review.",
};

export default function ReportIssuePage() {
  return (
    <main className="bg-background min-h-screen px-6 py-16">
      <div className="mx-auto max-w-xl">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-8 inline-block text-sm"
        >
          ← Back
        </Link>
        <h1 className="font-heading text-foreground mb-4 text-4xl font-bold">Report an Issue</h1>
        <p className="text-muted-foreground mb-8 text-sm">
          Dispute tickets are coming in Phase 8. Until then, please open a GitHub issue with the
          response text and the question you asked.
        </p>
        <div className="border-border bg-card rounded-xl border p-5">
          <p className="text-muted-foreground text-sm">
            Dispute system (Phase 8) will capture the full Iris tool-call trace alongside your
            report so the data source can be verified independently.
          </p>
        </div>
      </div>
    </main>
  );
}
