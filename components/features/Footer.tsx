import { Link } from "@/i18n/navigation";

export function Footer() {
  return (
    <footer className="border-border/40 bg-card/30 border-t py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          {/* Brand */}
          <div>
            <p className="font-heading text-primary text-sm font-semibold">PurpleIris</p>
            <p className="text-muted-foreground mt-2 max-w-xs text-xs leading-relaxed">
              Validator intelligence for the Monad blockchain. Track, analyze, and delegate smarter.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-12">
            <div>
              <p className="text-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                Product
              </p>
              <nav className="flex flex-col gap-2">
                {[
                  { href: "/validators", label: "Validators" },
                  { href: "/find", label: "Find Validator" },
                  { href: "/insights", label: "Insights" },
                  { href: "/learn", label: "Learn" },
                ].map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div>
              <p className="text-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                Ecosystem
              </p>
              <nav className="flex flex-col gap-2">
                {[
                  { href: "https://monad.xyz", label: "Monad" },
                  { href: "https://monadscan.io", label: "MonadScan" },
                  { href: "https://monad.xyz/stake", label: "Staking Docs" },
                ].map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col items-start sm:items-end">
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Network Online</span>
            </div>
            <p className="text-muted-foreground mt-4 text-xs">
              © {new Date().getFullYear()} PurpleIris
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
