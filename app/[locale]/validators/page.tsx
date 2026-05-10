import { Link } from "@/i18n/navigation";
import { getValidatorsFromChain } from "@/lib/monad/validators";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Validators" };
export const dynamic = "force-dynamic";

function fmtCommission(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

function fmtStake(wei: bigint) {
  const mon = Number(wei / 10n ** 18n);
  if (mon >= 1_000_000) return `${(mon / 1_000_000).toFixed(1)}M`;
  if (mon >= 1_000) return `${(mon / 1_000).toFixed(0)}K`;
  return mon.toString();
}

export default async function ValidatorsPage() {
  let validators = await getValidatorsFromChain().catch(() => []);
  const active = validators.filter((v) => v.active && !v.jailed);
  const jailed = validators.filter((v) => v.jailed);

  // Sort by staked amount descending
  active.sort((a, b) => (b.stakedAmount > a.stakedAmount ? 1 : -1));

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-primary mb-2 text-xs font-semibold tracking-wider uppercase">
          Monad Mainnet
        </p>
        <h1 className="font-heading text-foreground text-4xl font-bold">Validator Network</h1>
        <p className="text-muted-foreground mt-2">
          {active.length} active validators securing the Monad blockchain
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-10 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Active", value: active.length.toString(), color: "text-emerald-400" },
          { label: "Jailed", value: jailed.length.toString(), color: "text-red-400" },
          { label: "Total", value: validators.length.toString(), color: "text-foreground" },
          {
            label: "Avg Commission",
            value:
              active.length > 0
                ? fmtCommission(
                    Math.round(active.reduce((s, v) => s + v.commissionBps, 0) / active.length)
                  )
                : "—",
            color: "text-foreground",
          },
        ].map((s) => (
          <div key={s.label} className="border-border/40 bg-card rounded-2xl border p-5">
            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              {s.label}
            </p>
            <p className={`font-heading mt-2 text-3xl font-bold tabular-nums ${s.color}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="border-border/40 overflow-hidden rounded-2xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border/40 bg-muted/30 border-b">
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  #
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Validator
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right text-xs font-semibold tracking-wider uppercase">
                  Commission
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right text-xs font-semibold tracking-wider uppercase">
                  Staked (MON)
                </th>
                <th className="text-muted-foreground px-4 py-3 text-center text-xs font-semibold tracking-wider uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {active.slice(0, 100).map((v, idx) => (
                <tr
                  key={v.address}
                  className="border-border/20 bg-card/50 hover:bg-muted/20 border-b transition-colors"
                >
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-foreground font-medium">{v.moniker || "Unknown"}</p>
                      <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                        {v.address.slice(0, 8)}…{v.address.slice(-6)}
                      </p>
                    </div>
                  </td>
                  <td className="text-foreground px-4 py-3 text-right tabular-nums">
                    {fmtCommission(v.commissionBps)}
                  </td>
                  <td className="text-foreground px-4 py-3 text-right tabular-nums">
                    {fmtStake(v.stakedAmount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {active.length > 100 && (
          <div className="border-border/40 bg-muted/10 border-t px-4 py-3 text-center">
            <p className="text-muted-foreground text-xs">
              Showing top 100 of {active.length} validators
            </p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-10 text-center">
        <p className="text-muted-foreground mb-4">Not sure which validator to choose?</p>
        <Link
          href="/find"
          className="bg-primary text-primary-foreground shadow-primary/20 inline-flex h-11 items-center justify-center rounded-full px-8 text-sm font-semibold shadow-lg transition-all hover:opacity-90"
        >
          Find My Validator Match →
        </Link>
      </div>
    </div>
  );
}
