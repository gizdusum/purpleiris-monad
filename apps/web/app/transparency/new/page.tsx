"use client";

import { useState } from "react";
import Link from "next/link";

const WEB3FORMS_KEY = "64ed5b43-b951-4f27-9012-b1e9e6d9e860";

const CATEGORIES = [
  "Wrong information",
  "Slow response",
  "Visual / layout issue",
  "Feature request",
  "Validator data dispute",
  "Other",
] as const;

type Category = (typeof CATEGORIES)[number];

const inputStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: "var(--bg-elev-2)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  padding: "10px 14px",
  color: "var(--text)",
  fontFamily: "var(--font-mono), monospace",
  fontSize: "0.875rem",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "var(--text-dim)",
  fontFamily: "var(--font-mono), monospace",
  fontSize: "0.75rem",
  marginBottom: "6px",
};

export default function FeedbackPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `PurpleIris feedback - ${category}`,
          from_name: name,
          email,
          to: "giznode@gmail.com",
          category,
          message: description,
          source_url: typeof window !== "undefined" ? window.location.href : "",
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg)",
        padding: "48px 16px",
      }}
    >
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            color: "var(--text-mute)",
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.75rem",
            textDecoration: "none",
            display: "inline-block",
            marginBottom: "32px",
          }}
        >
          ← Back
        </Link>

        <h1
          style={{
            color: "var(--text)",
            fontFamily: "var(--font-mono), monospace",
            fontSize: "1.5rem",
            fontWeight: 700,
            marginBottom: "8px",
          }}
        >
          Send feedback
        </h1>
        <p
          style={{
            color: "var(--text-dim)",
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.875rem",
            marginBottom: "32px",
            lineHeight: "1.6",
          }}
        >
          Tell us what you experienced. We read every submission.
        </p>

        {status === "success" ? (
          <div>
            <p
              style={{
                color: "var(--text)",
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.875rem",
                marginBottom: "24px",
                lineHeight: "1.6",
              }}
            >
              Thanks — we got it. We&apos;ll review and respond if you left an email.
            </p>
            <Link
              href="/"
              style={{
                color: "var(--accent)",
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.875rem",
                textDecoration: "underline",
              }}
            >
              ← Back to chat
            </Link>
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Category</label>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} style={{ backgroundColor: "var(--bg-elev-2)" }}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                required
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened? What were you trying to do?"
                style={{ ...inputStyle, resize: "vertical", lineHeight: "1.6" }}
              />
            </div>

            {status === "error" && (
              <p
                style={{
                  color: "#f87171",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "0.75rem",
                }}
              >
                Couldn&apos;t send. Please try again or email giznode@gmail.com directly.
              </p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--text)",
                border: "none",
                borderRadius: "6px",
                padding: "12px 24px",
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: status === "loading" ? "not-allowed" : "pointer",
                opacity: status === "loading" ? 0.6 : 1,
                alignSelf: "flex-start",
              }}
            >
              {status === "loading" ? "Sending..." : "Send feedback"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
