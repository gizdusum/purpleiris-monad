"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-primary mt-3 text-xs transition-opacity hover:opacity-80"
    >
      {copied ? "✓ Copied!" : label}
    </button>
  );
}
