import { Link } from "@/i18n/navigation";

export function Footer() {
  return (
    <footer className="border-border/60 bg-background border-t py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="font-heading text-primary text-sm font-medium">
            See the chain through Iris.
          </p>
          <div className="text-muted-foreground flex gap-4 text-xs">
            <Link href="/learn" className="hover:text-foreground transition-colors">
              Learn
            </Link>
            <Link href="/insights" className="hover:text-foreground transition-colors">
              Insights
            </Link>
            <a
              href="https://monad.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Monad
            </a>
          </div>
          <p className="text-muted-foreground text-xs">© {new Date().getFullYear()} PurpleIris</p>
        </div>
      </div>
    </footer>
  );
}
