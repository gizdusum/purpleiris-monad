"use client";

import { useState, useCallback } from "react";
import { Link } from "@/i18n/navigation";

type Step = "connect" | "sign" | "claimed" | "edit";

const SIGN_MESSAGE = (address: string, timestamp: number) =>
  `I am claiming my PurpleIris validator profile.\n\nAddress: ${address}\nTimestamp: ${timestamp}\n\nThis signature only proves ownership. No transaction will be made.`;

export function OperatorClient() {
  const [step, setStep] = useState<Step>("connect");
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    displayName: "",
    location: "",
    hardware: "bare-metal" as "bare-metal" | "cloud" | "hybrid",
    provider: "",
    philosophy: "",
    twitter: "",
    website: "",
    github: "",
  });
  const [saved, setSaved] = useState(false);
  const [signTimestamp] = useState(() => Math.floor(Date.now() / 1000));

  const connect = useCallback(async () => {
    setError(null);
    if (typeof window === "undefined" || !("ethereum" in window)) {
      setError("No wallet detected. Please install MetaMask or a compatible wallet.");
      return;
    }
    setLoading(true);
    try {
      const eth = (
        window as Window & {
          ethereum: { request: (a: { method: string; params?: unknown[] }) => Promise<string[]> };
        }
      ).ethereum;
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const addr = accounts[0];
      if (!addr) throw new Error("No account returned");
      setAddress(addr);
      setStep("sign");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const sign = useCallback(async () => {
    if (!address) return;
    setError(null);
    setLoading(true);
    try {
      const eth = (
        window as unknown as {
          ethereum: { request: (a: { method: string; params?: unknown[] }) => Promise<string> };
        }
      ).ethereum;
      const timestamp = Math.floor(Date.now() / 1000);
      const message = SIGN_MESSAGE(address, timestamp);
      // eth_sign or personal_sign
      await eth.request({
        method: "personal_sign",
        params: [message, address],
      });
      // In production: send signature + address + timestamp to /api/operator/claim
      // to verify and store the claim in the database.
      setStep("claimed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signature failed or rejected");
    } finally {
      setLoading(false);
    }
  }, [address]);

  const saveProfile = useCallback(async () => {
    setLoading(true);
    // In production: POST to /api/operator/profile with authenticated session
    await new Promise((r) => setTimeout(r, 800));
    setSaved(true);
    setLoading(false);
    setTimeout(() => setSaved(false), 3000);
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wider uppercase">
          Operator Panel
        </div>
        <h1 className="font-heading text-foreground text-4xl font-bold">Claim Your Profile</h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm">
          Sign with your validator operator wallet to claim and customize your PurpleIris profile.
        </p>
      </div>

      {/* Step indicators */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {(["connect", "sign", "claimed"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : ["connect", "sign", "claimed", "edit"].indexOf(step) > i
                    ? "bg-primary/30 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            {i < 2 && <div className="bg-border h-px w-8" />}
          </div>
        ))}
      </div>

      {step === "connect" && (
        <div className="border-border/40 bg-card space-y-6 rounded-3xl border p-8 text-center">
          <div className="text-5xl">🔐</div>
          <div>
            <h2 className="text-foreground text-lg font-semibold">Step 1: Connect Wallet</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Connect the wallet that controls your validator node
            </p>
          </div>
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <button
            onClick={connect}
            disabled={loading}
            className="bg-primary text-primary-foreground h-12 w-full rounded-full text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Connecting…" : "Connect Wallet"}
          </button>
          <p className="text-muted-foreground text-xs">MetaMask, Rabby, or any EIP-1193 wallet</p>
        </div>
      )}

      {step === "sign" && address && (
        <div className="border-border/40 bg-card space-y-6 rounded-3xl border p-8 text-center">
          <div className="text-5xl">✍️</div>
          <div>
            <h2 className="text-foreground text-lg font-semibold">Step 2: Sign to Claim</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Sign a message to prove you control{" "}
              <span className="text-foreground font-mono text-xs">
                {address.slice(0, 8)}…{address.slice(-6)}
              </span>
            </p>
          </div>

          <div className="bg-muted/30 border-border/40 text-muted-foreground rounded-xl border p-4 text-left font-mono text-xs whitespace-pre-wrap">
            {SIGN_MESSAGE(address, signTimestamp)}
          </div>

          <p className="text-muted-foreground text-xs">
            This is a gasless off-chain signature. No transaction will be broadcast.
          </p>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setStep("connect")}
              className="border-border/60 text-muted-foreground hover:text-foreground flex-1 rounded-full border py-2.5 text-sm transition-colors"
            >
              Back
            </button>
            <button
              onClick={sign}
              disabled={loading}
              className="bg-primary text-primary-foreground flex-[2] rounded-full py-2.5 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Signing…" : "Sign & Claim →"}
            </button>
          </div>
        </div>
      )}

      {(step === "claimed" || step === "edit") && (
        <div className="space-y-4">
          {step === "claimed" && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
              <p className="font-semibold text-emerald-400">✅ Profile Claimed Successfully</p>
              <p className="text-muted-foreground mt-1 text-sm">
                You can now edit your validator profile.
              </p>
              <button
                onClick={() => setStep("edit")}
                className="mt-3 text-sm text-emerald-400 hover:underline"
              >
                Edit Profile →
              </button>
            </div>
          )}

          {step === "edit" && (
            <div className="border-border/40 bg-card space-y-5 rounded-2xl border p-6">
              <h2 className="text-foreground font-semibold">Edit Validator Profile</h2>

              <Field
                label="Display Name"
                placeholder="e.g. Chorus One"
                value={profile.displayName}
                onChange={(v) => setProfile((p) => ({ ...p, displayName: v }))}
              />
              <Field
                label="Location (Country / Region)"
                placeholder="e.g. Switzerland / Europe"
                value={profile.location}
                onChange={(v) => setProfile((p) => ({ ...p, location: v }))}
              />

              <div>
                <label className="text-foreground mb-2 block text-sm font-medium">
                  Hardware Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["bare-metal", "cloud", "hybrid"] as const).map((hw) => (
                    <button
                      key={hw}
                      onClick={() => setProfile((p) => ({ ...p, hardware: hw }))}
                      className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                        profile.hardware === hw
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {hw === "bare-metal"
                        ? "🖥 Bare Metal"
                        : hw === "cloud"
                          ? "☁️ Cloud"
                          : "🔀 Hybrid"}
                    </button>
                  ))}
                </div>
              </div>

              <Field
                label="Infrastructure Provider"
                placeholder="e.g. Hetzner, AWS, OVH, Equinix"
                value={profile.provider}
                onChange={(v) => setProfile((p) => ({ ...p, provider: v }))}
              />
              <TextArea
                label="Philosophy (280 chars)"
                placeholder="What drives your operation? Why are you a Monad validator?"
                value={profile.philosophy}
                maxLength={280}
                onChange={(v) => setProfile((p) => ({ ...p, philosophy: v }))}
              />
              <Field
                label="Twitter / X handle"
                placeholder="@yourhandle"
                value={profile.twitter}
                onChange={(v) => setProfile((p) => ({ ...p, twitter: v }))}
              />
              <Field
                label="Website"
                placeholder="https://yoursite.com"
                value={profile.website}
                onChange={(v) => setProfile((p) => ({ ...p, website: v }))}
              />
              <Field
                label="GitHub"
                placeholder="https://github.com/yourorg"
                value={profile.github}
                onChange={(v) => setProfile((p) => ({ ...p, github: v }))}
              />

              <button
                onClick={saveProfile}
                disabled={loading}
                className="bg-primary text-primary-foreground h-11 w-full rounded-full text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Saving…" : saved ? "✓ Saved!" : "Save Profile"}
              </button>
            </div>
          )}

          {/* Differentiation opportunities */}
          <div className="border-border/40 bg-card rounded-2xl border p-6">
            <h3 className="text-foreground mb-1 text-sm font-semibold">
              🎯 Differentiation Opportunities
            </h3>
            <p className="text-muted-foreground mb-4 text-xs">
              Ways to stand out and earn unique badges
            </p>
            <div className="space-y-3">
              {[
                {
                  badge: "🌍 Geographic Outlier",
                  desc: "Operate from a region with fewer than 3 validators",
                  action: "Update your location above",
                },
                {
                  badge: "🖥 Bare Metal Loyalist",
                  desc: "Run on your own hardware, not a cloud provider",
                  action: "Set hardware to Bare Metal",
                },
                {
                  badge: "⚙️ Provider Diversity",
                  desc: "Use an uncommon infra provider (not AWS/GCP/Azure)",
                  action: "Update your provider above",
                },
                {
                  badge: "🧑‍💻 Solo Operator",
                  desc: "Individual operator, not a corporation",
                  action: "Add 'Solo Operator' to your philosophy",
                },
              ].map((opp) => (
                <div key={opp.badge} className="bg-muted/20 flex items-start gap-3 rounded-xl p-3">
                  <span className="text-lg">{opp.badge.split(" ")[0]}</span>
                  <div>
                    <p className="text-foreground text-xs font-semibold">{opp.badge.slice(2)}</p>
                    <p className="text-muted-foreground text-xs">{opp.desc}</p>
                    <p className="text-primary mt-0.5 text-xs">→ {opp.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/validators"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              ← Back to Validators
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-foreground mb-1.5 block text-sm font-medium">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border/60 bg-muted/30 text-foreground placeholder:text-muted-foreground/50 focus:ring-primary/40 w-full rounded-xl border px-4 py-2.5 text-sm focus:ring-2 focus:outline-none"
      />
    </div>
  );
}

function TextArea({
  label,
  placeholder,
  value,
  maxLength,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  maxLength: number;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-foreground mb-1.5 block text-sm font-medium">{label}</label>
      <textarea
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        className="border-border/60 bg-muted/30 text-foreground placeholder:text-muted-foreground/50 focus:ring-primary/40 w-full resize-none rounded-xl border px-4 py-2.5 text-sm focus:ring-2 focus:outline-none"
      />
      <p className="text-muted-foreground mt-1 text-right text-xs">
        {value.length}/{maxLength}
      </p>
    </div>
  );
}
