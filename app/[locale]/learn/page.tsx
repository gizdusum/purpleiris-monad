import { Link } from "@/i18n/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Learn — Monad Staking" };

const ARTICLES = [
  {
    category: "Fundamentals",
    title: "What is Proof of Stake on Monad?",
    desc: "Monad uses a Delegated Proof of Stake (DPoS) consensus mechanism. Learn how validators and delegators work together to secure the network.",
    readTime: "5 min",
    href: "#",
  },
  {
    category: "Fundamentals",
    title: "How to Choose a Validator",
    desc: "Commission rates, uptime, decentralization score — understand what each metric means and how it affects your returns.",
    readTime: "8 min",
    href: "#",
  },
  {
    category: "Strategy",
    title: "Diversifying Your Stake",
    desc: "Spreading stake across multiple validators reduces risk and actively strengthens Monad's decentralization. Here's how to do it.",
    readTime: "6 min",
    href: "#",
  },
  {
    category: "Strategy",
    title: "Understanding the Nakamoto Coefficient",
    desc: "The Nakamoto coefficient measures how many validators would need to collude to compromise the network. Higher is always better.",
    readTime: "4 min",
    href: "#",
  },
  {
    category: "For Operators",
    title: "Running a Monad Validator",
    desc: "Technical requirements, hardware specs, and best practices for operating a Monad validator node reliably.",
    readTime: "12 min",
    href: "#",
  },
  {
    category: "For Operators",
    title: "Attracting Delegators",
    desc: "How to differentiate your validator, set competitive commission, and build the reputation needed to grow your delegation.",
    readTime: "7 min",
    href: "#",
  },
];

const FAQS = [
  {
    q: "What is the minimum stake amount on Monad?",
    a: "There is no minimum stake amount for delegators. You can delegate any amount of MON to a validator of your choice.",
  },
  {
    q: "How often are staking rewards distributed?",
    a: "Staking rewards on Monad are distributed every epoch (approximately every 5.5 hours). Rewards are automatically compounded.",
  },
  {
    q: "Can I unstake at any time?",
    a: "Yes, but there is an unbonding period. After initiating an unstake, your MON will be locked for approximately 21 days before you can withdraw.",
  },
  {
    q: "What happens if my validator gets jailed?",
    a: "If your validator is jailed due to downtime or slashing, you stop earning rewards during that period. It's advisable to redelegate to a different validator promptly.",
  },
];

export default function LearnPage() {
  const categories = [...new Set(ARTICLES.map((a) => a.category))];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <p className="text-primary mb-2 text-xs font-semibold tracking-wider uppercase">
          Education Center
        </p>
        <h1 className="font-heading text-foreground text-4xl font-bold">Learn Monad Staking</h1>
        <p className="text-muted-foreground mt-2">
          Everything you need to stake confidently and understand the Monad validator ecosystem.
        </p>
      </div>

      {/* Articles by category */}
      {categories.map((cat) => (
        <div key={cat} className="mb-10">
          <h2 className="font-heading text-foreground mb-4 text-lg font-semibold">{cat}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {ARTICLES.filter((a) => a.category === cat).map((article) => (
              <a
                key={article.title}
                href={article.href}
                className="group border-border/60 bg-card hover:border-primary/30 hover:bg-primary/5 flex flex-col gap-3 rounded-2xl border p-5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {article.category}
                  </span>
                  <span className="text-muted-foreground text-xs">{article.readTime} read</span>
                </div>
                <h3 className="font-heading text-foreground group-hover:text-primary text-base font-semibold">
                  {article.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{article.desc}</p>
                <span className="text-primary mt-auto text-xs font-medium">Read article →</span>
              </a>
            ))}
          </div>
        </div>
      ))}

      {/* FAQ */}
      <div className="mb-12">
        <h2 className="font-heading text-foreground mb-6 text-2xl font-semibold">
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <div key={faq.q} className="border-border/40 bg-card rounded-2xl border p-5">
              <h3 className="font-heading text-foreground mb-2 text-sm font-semibold">{faq.q}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="border-primary/20 from-primary/10 via-card to-card rounded-3xl border bg-gradient-to-br p-8 text-center">
        <h2 className="font-heading text-foreground text-2xl font-bold">Ready to stake?</h2>
        <p className="text-muted-foreground mx-auto mt-3 max-w-sm">
          Use the Iris Wizard to find the perfect validator in 60 seconds.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/find"
            className="bg-primary text-primary-foreground shadow-primary/20 inline-flex h-11 items-center justify-center rounded-full px-7 text-sm font-semibold shadow-lg transition-all hover:opacity-90"
          >
            Find My Validator →
          </Link>
          <Link
            href="/validators"
            className="border-border text-muted-foreground hover:text-foreground inline-flex h-11 items-center justify-center rounded-full border px-7 text-sm font-medium transition-colors"
          >
            Browse All Validators
          </Link>
        </div>
      </div>
    </div>
  );
}
