"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

// Get your free access key at https://web3forms.com — enter giznode@gmail.com
// then replace this constant and redeploy.
const WEB3FORMS_KEY = "REPLACE_WITH_WEB3FORMS_ACCESS_KEY";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  mode: "delegator" | "operator";
  lastAssistantContent?: string | undefined;
  validatorIdentifier?: string | undefined;
}

export function FeedbackModal({
  open,
  onClose,
  mode,
  lastAssistantContent,
  validatorIdentifier,
}: FeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when modal opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Auto-close 2 s after success
  useEffect(() => {
    if (status !== "success") return;
    const t = setTimeout(() => {
      onClose();
      setStatus("idle");
      setMessage("");
    }, 2000);
    return () => clearTimeout(t);
  }, [status, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed || status === "loading") return;
    setStatus("loading");

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `PurpleIris feedback - ${mode}`,
          from_name: "PurpleIris Hermes",
          to: "giznode@gmail.com",
          message: trimmed,
          context_mode: mode,
          context_message: (lastAssistantContent ?? "").slice(0, 1000),
          context_validator: validatorIdentifier ?? "(none)",
          context_timestamp: new Date().toISOString(),
          context_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "server",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(6px)", backgroundColor: "rgba(7,6,26,0.82)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-xl"
        style={{ backgroundColor: "var(--bg-elev)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--text)", fontFamily: "var(--font-mono), monospace" }}
          >
            Send feedback
          </p>
          <button
            onClick={onClose}
            aria-label="Close feedback modal"
            className="rounded p-1 transition-colors"
            style={{ color: "var(--text-mute)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "var(--text)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-mute)")
            }
          >
            <X size={16} />
          </button>
        </div>

        {/* Success state */}
        {status === "success" ? (
          <p
            className="py-8 text-center text-sm"
            style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono), monospace" }}
          >
            Thanks — got it. We&apos;ll review.
          </p>
        ) : (
          <>
            <textarea
              ref={textareaRef}
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What went wrong? What could be better?"
              className="w-full resize-none rounded-lg border p-3 text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-elev-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
                fontFamily: "var(--font-mono), monospace",
                lineHeight: "1.6",
              }}
            />

            {/* Context hint */}
            <p
              className="mt-2 text-xs"
              style={{ color: "var(--text-mute)", fontFamily: "var(--font-mono), monospace" }}
            >
              Mode: {mode} · Message context attached
            </p>

            {/* Error state */}
            {status === "error" && (
              <p
                className="mt-2 text-xs"
                style={{ color: "#f87171", fontFamily: "var(--font-mono), monospace" }}
              >
                Couldn&apos;t send. Try again or email giznode@gmail.com directly.
              </p>
            )}

            {/* Actions */}
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm transition-colors"
                style={{
                  color: "var(--text-mute)",
                  border: "1px solid var(--border)",
                  backgroundColor: "transparent",
                  fontFamily: "var(--font-mono), monospace",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color = "var(--text)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-mute)")
                }
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSubmit()}
                disabled={!message.trim() || status === "loading"}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--text)",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {status === "loading" ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
