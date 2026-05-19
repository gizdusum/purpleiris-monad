"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { IrisResponse } from "@purpleiris/iris-agent";
import IrisBackdrop from "@/components/IrisBackdrop";
import { AddressModal } from "@/components/AddressModal";
import { applyIrisMarkers, parseSuggestions } from "@/lib/iris-markdown";
import { getRemembered, remember, forget, type RememberedValidator } from "@/lib/validator-memory";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
  toolCount?: number;
  suggestions?: string[];
};

const NETWORK_QUESTIONS = [
  "Show me the network overview",
  "Top validators by stake",
  "Find underrated validators worth supporting",
];

const MY_VALIDATOR_QUESTIONS = [
  "Show me my full health profile",
  "Am I at VDP risk?",
  "What are my last 20 rounds?",
];

const OPERATOR_GREETING = `Hey, operator. I'm Iris — here to help with your Monad node.

Running a validator is real work. Paste your address or moniker and I'll show you what the network sees. Or grab a quick query below.`;

function substituteMyRef(q: string, displayName: string): string {
  return q
    .replace(/\bAm I\b/g, `Is ${displayName}`)
    .replace(/\bdo I\b/g, `does ${displayName}`)
    .replace(/\bI'm\b/g, `${displayName} is`)
    .replace(/\bI\b/g, displayName)
    .replace(/\bmy\b/g, `${displayName}'s`);
}

export function OperatorChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remembered, setRemembered] = useState<RememberedValidator | null>(null);
  const [modal, setModal] = useState<{ pending: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setRemembered(getRemembered());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setError(null);
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/chat/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as IrisResponse;
      const { displayContent, suggestions } = parseSuggestions(data.text);
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: displayContent,
        toolCount: data.tool_calls.length,
        suggestions,
      };
      setMessages([...history, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleMyValidatorQuestion(q: string) {
    if (remembered) {
      const displayName = remembered.moniker ?? remembered.address;
      void send(substituteMyRef(q, displayName));
    } else {
      setModal({ pending: q });
    }
  }

  function handleModalSubmit(address: string, moniker: string | undefined, doRemember: boolean) {
    const v: RememberedValidator = {
      address,
      saved_at: Date.now(),
      ...(moniker !== undefined && { moniker }),
    };
    if (doRemember) {
      remember(v);
      setRemembered(v);
    }
    if (modal) {
      const displayName = moniker ?? address;
      void send(substituteMyRef(modal.pending, displayName));
      setModal(null);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  const isEmpty = messages.length === 0;
  const badgeLabel = remembered
    ? (remembered.moniker ?? `${remembered.address.slice(0, 6)}...${remembered.address.slice(-4)}`)
    : null;

  return (
    <div className="flex h-screen flex-col" style={{ position: "relative" }}>
      <IrisBackdrop intensity="ghost" />

      {/* Header */}
      <header
        className="border-border flex items-center justify-between border-b px-4 py-3"
        style={{ position: "relative", zIndex: 1 }}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
            ← Back
          </Link>
          <div className="bg-border h-4 w-px" />
          <div>
            <p className="text-foreground text-sm font-semibold">Iris — Operator Mode</p>
            <p className="text-muted-foreground text-xs">Validator diagnostics · read-only v1.0</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {badgeLabel && (
            <div
              className="flex items-center text-xs tracking-wider uppercase"
              style={{
                border: "1px solid var(--cat-operator)",
                borderRadius: "4px",
                padding: "4px 10px",
                color: "var(--cat-operator)",
                backgroundColor: "transparent",
              }}
            >
              🟣 {badgeLabel}
              <button
                onClick={() => {
                  forget();
                  setRemembered(null);
                }}
                className="ml-2 text-sm"
                style={{ color: "var(--text-mute)", cursor: "pointer" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color = "var(--cat-operator)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-mute)")
                }
                aria-label="Forget validator"
              >
                ×
              </button>
            </div>
          )}
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: "color-mix(in srgb, var(--cat-operator) 10%, transparent)",
              color: "var(--cat-operator)",
            }}
          >
            Live
          </span>
        </div>
      </header>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto" style={{ position: "relative", zIndex: 1 }}>
        {isEmpty ? (
          <div className="mx-auto space-y-6 px-4 py-6" style={{ maxWidth: "920px" }}>
            {/* Greeting bubble */}
            <div className="flex flex-col items-start">
              <div className="border-border bg-card text-foreground max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-relaxed">
                <IrisMarkdown text={OPERATOR_GREETING} />
              </div>
            </div>

            {/* Ghost pills */}
            <div>
              <p className="iris-ghost-pill-group-label">NETWORK</p>
              <div className="flex flex-wrap gap-2">
                {NETWORK_QUESTIONS.map((q) => (
                  <button key={q} onClick={() => void send(q)} className="iris-ghost-pill">
                    {q}
                  </button>
                ))}
              </div>
              <p className="iris-ghost-pill-group-label">MY VALIDATOR</p>
              <div className="flex flex-wrap gap-2">
                {MY_VALIDATOR_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleMyValidatorQuestion(q)}
                    className="iris-ghost-pill"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto space-y-6 px-4 py-6" style={{ maxWidth: "920px" }}>
            {messages.map((m, i) => (
              <OperatorMessageBubble
                key={m.id}
                message={m}
                isLast={i === messages.length - 1}
                onSuggest={(s) => void send(s)}
              />
            ))}
            {loading && <ThinkingIndicator />}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-border border-t px-4 py-3" style={{ position: "relative", zIndex: 1 }}>
        <form
          onSubmit={handleSubmit}
          className="border-border bg-card mx-auto flex items-end gap-2 rounded-2xl border px-4 py-3 focus-within:ring-2"
          style={
            {
              maxWidth: "920px",
              "--tw-ring-color": "color-mix(in srgb, var(--cat-operator) 40%, transparent)",
            } as React.CSSProperties
          }
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoResize();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Query validator data…"
            disabled={loading}
            className="text-foreground placeholder:text-muted-foreground flex-1 resize-none bg-transparent text-sm outline-none disabled:opacity-50"
            style={{ maxHeight: 160 }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "var(--cat-operator)", color: "var(--text)" }}
          >
            ↑
          </button>
        </form>
        <p className="text-muted-foreground mt-2 text-center text-xs">
          Read-only access · v1.0 Iris · No financial advice.{" "}
          <Link
            href="/transparency/new"
            className="underline underline-offset-2"
            style={{ color: "var(--cat-operator)" }}
          >
            Report an issue
          </Link>
        </p>
      </div>

      <AddressModal
        open={modal !== null}
        onClose={() => setModal(null)}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
}

function OperatorMessageBubble({
  message,
  isLast,
  onSuggest,
}: {
  message: Message;
  isLast: boolean;
  onSuggest: (s: string) => void;
}) {
  const isUser = message.role === "user";
  const showBack = !isUser && isLast;
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser ? "text-primary-foreground" : "border-border bg-card text-foreground border",
        ].join(" ")}
        style={isUser ? { backgroundColor: "var(--cat-operator)" } : undefined}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <IrisMarkdown text={message.content} />
        )}
        {!isUser && message.toolCount !== undefined && (
          <div className="mt-2 flex items-center gap-2 border-t border-current/10 pt-2 text-xs opacity-60">
            <span>
              {message.toolCount} tool call{message.toolCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
      {!isUser && message.suggestions && message.suggestions.length > 0 && (
        <div className="mt-2 flex max-w-[85%] flex-wrap gap-2">
          {message.suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSuggest(s)}
              className="border-border bg-card hover:border-iris-primary text-muted-foreground hover:text-foreground rounded-xl border px-3 py-1.5 text-left text-xs transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {showBack && (
        <div className="mt-2">
          <Link href="/" className="iris-back-btn">
            <span style={{ marginRight: "4px" }}>←</span> Back to home
          </Link>
        </div>
      )}
    </div>
  );
}

function IrisMarkdown({ text }: { text: string }) {
  const processed = applyIrisMarkers(text);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        p({ children }) {
          return <p style={{ marginBottom: "12px", lineHeight: "1.7" }}>{children}</p>;
        },
        table({ children }) {
          return (
            <div style={{ overflowX: "auto", marginBottom: "12px" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th
              style={{
                padding: "8px 12px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-elev-2)",
                color: "var(--text)",
                textAlign: "left",
                fontWeight: 700,
              }}
            >
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td
              style={{
                padding: "8px 12px",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            >
              {children}
            </td>
          );
        },
        pre({ children }) {
          return <pre className="iris-code-block">{children}</pre>;
        },
        code({ children, className }) {
          const rawChildren = String(children ?? "");
          const isBlock = rawChildren.endsWith("\n") || Boolean(className);
          const decoded = rawChildren
            .replace(/\n$/, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
          const html = applyIrisMarkers(decoded);
          if (isBlock) {
            return (
              <code
                className={className}
                style={{ fontFamily: "var(--font-mono), monospace", color: "var(--text)" }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }
          return (
            <code
              style={{
                backgroundColor: "var(--bg-elev-2)",
                borderRadius: "3px",
                padding: "2px 6px",
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.875rem",
                color: "var(--text)",
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "underline" }}
            >
              {children}
            </a>
          );
        },
        ul({ children }) {
          return (
            <ul style={{ listStyleType: "disc", paddingLeft: "24px", marginBottom: "12px" }}>
              {children}
            </ul>
          );
        },
        ol({ children }) {
          return (
            <ol style={{ listStyleType: "decimal", paddingLeft: "24px", marginBottom: "12px" }}>
              {children}
            </ol>
          );
        },
        li({ children }) {
          return <li style={{ marginBottom: "4px" }}>{children}</li>;
        },
        strong({ children }) {
          return <strong style={{ fontWeight: 700, color: "var(--text)" }}>{children}</strong>;
        },
        h1({ children }) {
          return (
            <h1
              style={{
                fontWeight: 700,
                fontSize: "1.125rem",
                color: "var(--text)",
                marginTop: "16px",
                marginBottom: "8px",
              }}
            >
              {children}
            </h1>
          );
        },
        h2({ children }) {
          return (
            <h2
              style={{
                fontWeight: 700,
                fontSize: "1rem",
                color: "var(--text)",
                marginTop: "12px",
                marginBottom: "8px",
              }}
            >
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return (
            <h3
              style={{
                fontWeight: 600,
                fontSize: "0.875rem",
                color: "var(--text)",
                marginTop: "10px",
                marginBottom: "6px",
              }}
            >
              {children}
            </h3>
          );
        },
      }}
    >
      {processed}
    </ReactMarkdown>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="border-border bg-card flex items-center gap-2 rounded-2xl border px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-bounce rounded-full"
              style={{ backgroundColor: "var(--cat-operator)", animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
        <span className="text-muted-foreground text-xs">Iris is querying…</span>
      </div>
    </div>
  );
}
