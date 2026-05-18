"use client";

import { useState, useEffect, useRef } from "react";

interface AddressModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (address: string, moniker: string | undefined, remember: boolean) => void;
}

export function AddressModal({ open, onClose, onSubmit }: AddressModalProps) {
  const [value, setValue] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      // Small delay so the DOM is mounted before we focus
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = value.trim();
  const isAddress = /^0x[0-9a-fA-F]+$/.test(trimmed);
  const canSubmit = trimmed.length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(trimmed, isAddress ? undefined : trimmed, rememberMe);
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
        backgroundColor: "rgba(0,0,0,0.45)",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--bg-elev)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "24px",
          width: "100%",
          maxWidth: "400px",
          margin: "0 16px",
        }}
      >
        <p
          style={{
            color: "var(--text)",
            fontWeight: 700,
            fontSize: "1rem",
            marginBottom: "6px",
          }}
        >
          Enter your validator
        </p>
        <p
          style={{
            color: "var(--text-mute)",
            fontSize: "0.75rem",
            marginBottom: "16px",
            lineHeight: "1.5",
          }}
        >
          Use your Ethereum address (0x...) or moniker name.
        </p>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) handleSubmit();
          }}
          placeholder="0xbb8ee... or Backpack"
          style={{
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            backgroundColor: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "8px 12px",
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.875rem",
            color: "var(--text)",
            outline: "none",
            marginBottom: "16px",
          }}
        />

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            marginBottom: "20px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={{ marginTop: "2px", accentColor: "var(--accent)" }}
          />
          <span>
            <span style={{ color: "var(--text)", fontSize: "0.75rem" }}>
              Remember on this device
            </span>
            <br />
            <span style={{ color: "var(--text-mute)", fontSize: "0.7rem" }}>
              Stored only in your browser. Clear anytime via the badge in the header.
            </span>
          </span>
        </label>

        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "0.75rem",
              color: "var(--text-mute)",
              backgroundColor: "transparent",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              border: `1px solid var(--accent)`,
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "0.75rem",
              color: "var(--accent)",
              backgroundColor: canSubmit
                ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                : "transparent",
              cursor: canSubmit ? "pointer" : "not-allowed",
              opacity: canSubmit ? 1 : 0.5,
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
