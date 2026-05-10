"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useParams } from "next/navigation";

const IrisLogo = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <circle cx="14" cy="14" r="13" stroke="#B8A5E8" strokeWidth="1.5" />
    <circle cx="14" cy="14" r="7" fill="#6B4FBB" />
    <circle cx="14" cy="14" r="3" fill="#B8A5E8" />
    <circle cx="16" cy="12" r="1" fill="white" opacity="0.7" />
  </svg>
);

type Props = { locale: string };

export function Header({ locale }: Props) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();

  const otherLocale = locale === "en" ? "tr" : "en";

  function switchLocale() {
    router.replace(pathname, { locale: otherLocale, ...params });
  }

  const navLinks = [
    { href: "/validators", label: t("validators") },
    { href: "/find", label: t("find") },
    { href: "/insights", label: t("insights") },
    { href: "/learn", label: t("learn") },
  ];

  return (
    <header className="border-border/60 bg-background/90 sticky top-0 z-50 border-b backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="font-heading flex items-center gap-2 text-lg font-semibold">
          <IrisLogo />
          <span className="text-primary">Purple</span>
          <span className="text-foreground/90">Iris</span>
        </Link>

        {/* Nav — hidden on mobile */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:bg-accent/20 hover:text-foreground rounded-md px-3 py-1.5 text-sm transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button
            onClick={switchLocale}
            className="border-border/60 text-muted-foreground hover:bg-accent/20 hover:text-foreground rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
            aria-label={`Switch to ${otherLocale === "en" ? "English" : "Türkçe"}`}
          >
            {otherLocale === "en" ? "EN" : "TR"}
          </button>
          <Link
            href="/find"
            className="bg-primary text-primary-foreground rounded-md px-3.5 py-1.5 text-sm font-medium transition-opacity hover:opacity-90"
          >
            {t("find")}
          </Link>
        </div>
      </div>
    </header>
  );
}
