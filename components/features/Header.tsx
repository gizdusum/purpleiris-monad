"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

const IrisLogo = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="16" cy="16" r="15" stroke="oklch(0.62 0.26 291)" strokeWidth="1.5" />
    <circle cx="16" cy="16" r="9" fill="oklch(0.62 0.26 291)" opacity="0.9" />
    <circle cx="16" cy="16" r="4" fill="oklch(0.80 0.14 291)" />
    <circle cx="18.5" cy="13.5" r="1.5" fill="white" opacity="0.8" />
    <circle cx="16" cy="16" r="15" stroke="oklch(0.80 0.14 291)" strokeWidth="0.5" opacity="0.3" />
  </svg>
);

export function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NAV_LINKS = [
    { href: "/validators" as const, label: t("nav.validators") },
    { href: "/find" as const, label: t("nav.find") },
    { href: "/insights" as const, label: t("nav.insights") },
    { href: "/learn" as const, label: t("nav.learn") },
  ];

  function toggleLocale() {
    const next = locale === "en" ? "tr" : "en";
    router.replace(pathname, { locale: next });
  }

  return (
    <header className="border-border/40 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link
          href="/"
          className="font-heading flex items-center gap-2.5 text-lg font-semibold"
          onClick={() => setMobileOpen(false)}
        >
          <IrisLogo />
          <span>
            <span className="text-primary">Purple</span>
            <span className="text-foreground">Iris</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Locale toggle */}
          <button
            onClick={toggleLocale}
            className="border-border/60 text-muted-foreground hover:text-foreground hidden h-8 items-center justify-center rounded-lg border px-2.5 text-xs font-semibold transition-colors sm:flex"
            aria-label={`Switch to ${locale === "en" ? "Turkish" : "English"}`}
          >
            {t("header.switchLocale")}
          </button>

          <Link
            href="/find"
            className="bg-primary text-primary-foreground shadow-primary/20 hidden h-9 items-center justify-center rounded-full px-5 text-sm font-semibold shadow-md transition-all hover:opacity-90 sm:inline-flex"
          >
            {t("header.getStarted")}
          </Link>

          {/* Mobile toggle */}
          <button
            className="border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 items-center justify-center rounded-lg border transition-colors md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={t("header.toggleMenu")}
          >
            {mobileOpen ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="size-4"
                strokeWidth="2"
              >
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="size-4"
                strokeWidth="2"
              >
                <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-border/40 bg-background/95 border-t px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  toggleLocale();
                  setMobileOpen(false);
                }}
                className="border-border/60 text-muted-foreground h-10 flex-1 rounded-full border text-sm font-semibold"
              >
                {t("header.switchLocale")}
              </button>
              <Link
                href="/find"
                onClick={() => setMobileOpen(false)}
                className="bg-primary text-primary-foreground flex-[2] rounded-full py-2.5 text-center text-sm font-semibold"
              >
                {t("header.getStarted")}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
