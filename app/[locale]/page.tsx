import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { NetworkWeather } from "@/components/features/NetworkWeather";
import { getMockNetworkSnapshot } from "@/lib/monad/mock-data";

export default function HomePage() {
  const t = useTranslations("home");
  const snapshot = getMockNetworkSnapshot();

  return (
    <>
      {/* Hero */}
      <section className="border-border/40 from-iris-navy/5 via-background to-background dark:from-iris-navy dark:via-background relative overflow-hidden border-b bg-gradient-to-b pt-20 pb-12">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <p className="text-primary mb-3 text-xs font-semibold tracking-widest uppercase">
            Monad Validator Intelligence
          </p>
          <h1 className="font-heading text-foreground text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            {t("tagline")}
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base sm:text-lg">
            {t("subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/find"
              className="bg-primary text-primary-foreground inline-flex h-11 items-center justify-center rounded-full px-8 text-sm font-semibold shadow-sm transition-opacity hover:opacity-90"
            >
              Find Your Validators →
            </Link>
            <Link
              href="/validators"
              className="border-border text-foreground hover:bg-accent/20 inline-flex h-11 items-center justify-center rounded-full border px-8 text-sm font-medium transition-colors"
            >
              Browse Validators
            </Link>
          </div>
        </div>
      </section>

      {/* Network Weather */}
      <NetworkWeather data={snapshot} />

      {/* Value props */}
      <section className="border-border/40 bg-muted/30 border-t py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-3">
            <ValueCard
              icon="🎯"
              title="60-Second Decisions"
              desc="Answer 5 questions. Get a personalized validator shortlist with reasons."
            />
            <ValueCard
              icon="🌐"
              title="Decentralization First"
              desc="Every metric weighted to help Monad stay censorship-resistant."
            />
            <ValueCard
              icon="📊"
              title="Operator Intelligence"
              desc="Validators: see how to differentiate and attract more delegators."
            />
          </div>
        </div>
      </section>
    </>
  );
}

function ValueCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-3xl">{icon}</span>
      <h3 className="font-heading text-foreground text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
