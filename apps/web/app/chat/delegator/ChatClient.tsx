"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import IrisBackdrop from "@/components/IrisBackdrop";
import { AddressModal } from "@/components/AddressModal";
import { applyIrisMarkers, parseSuggestions, stripSuggestionsForStream } from "@/lib/iris-markdown";
import { getRemembered, remember, forget, type RememberedValidator } from "@/lib/validator-memory";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
  streaming?: boolean;
  guardPassed?: boolean;
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

const DELEGATOR_GREETING = `Hi 👋 — I'm Iris, your Monad validator intelligence agent.

Running or delegating to a validator? Drop your validator address or moniker name and I'll pull the full profile.

Or pick a quick query below.`;

function substituteMyRef(q: string, displayName: string): string {
  return q
    .replace(/\bAm I\b/g, `Is ${displayName}`)
    .replace(/\bdo I\b/g, `does ${displayName}`)
    .replace(/\bI'm\b/g, `${displayName} is`)
    .replace(/\bI\b/g, displayName)
    .replace(/\bmy\b/g, `${displayName}'s`);
}

export function ChatClient() {
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

    const assistantId = crypto.randomUUID();
    setMessages([...history, { id: assistantId, role: "assistant", content: "", streaming: true }]);

    try {
      const res = await fetch("/api/chat/delegator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: {
            type: string;
            text?: string;
            tool_calls?: number;
            guard_passed?: boolean;
            message?: string;
          };
          try {
            event = JSON.parse(raw) as typeof event;
          } catch {
            continue;
          }

          if (event.type === "delta" && event.text) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + event.text! } : m
              )
            );
          } else if (event.type === "done") {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const { displayContent, suggestions } = parseSuggestions(m.content);
                return {
                  ...m,
                  content: displayContent,
                  streaming: false,
                  toolCount: event.tool_calls ?? 0,
                  guardPassed: event.guard_passed ?? true,
                  suggestions,
                };
              })
            );
            setLoading(false);
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Stream error");
          }
        }
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      setError(err instanceof Error ? err.message : "Something went wrong.");
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
            <p className="text-foreground text-sm font-semibold">Iris — Delegator Mode</p>
            <p className="text-muted-foreground text-xs">Monad validator intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {badgeLabel && (
            <div
              className="flex items-center text-xs tracking-wider uppercase"
              style={{
                border: "1px solid var(--accent)",
                borderRadius: "4px",
                padding: "4px 10px",
                color: "var(--accent)",
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
                  ((e.currentTarget as HTMLButtonElement).style.color = "var(--accent)")
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
          <a
            href="https://www.gmonads.com/staking"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs"
            style={{ color: "var(--text-mute)" }}
          >
            Stake via gmonads ↗
          </a>
          <span className="bg-iris-primary/10 text-iris-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
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
                <IrisMarkdown text={DELEGATOR_GREETING} streaming={false} />
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
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onSuggest={(s) => void send(s)} />
            ))}
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
          className="border-border bg-card focus-within:ring-iris-primary/40 mx-auto flex items-end gap-2 rounded-2xl border px-4 py-3 focus-within:ring-2"
          style={{ maxWidth: "920px" }}
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
            placeholder="Ask Iris about validators…"
            disabled={loading}
            className="text-foreground placeholder:text-muted-foreground flex-1 resize-none bg-transparent text-sm outline-none disabled:opacity-50"
            style={{ maxHeight: 160 }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-iris-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-opacity disabled:opacity-40"
          >
            ↑
          </button>
        </form>
        <p className="text-muted-foreground mt-2 text-center text-xs">
          Iris does not provide financial advice.{" "}
          <Link href="/transparency/new" className="text-iris-primary underline underline-offset-2">
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

function MessageBubble({
  message,
  onSuggest,
}: {
  message: Message;
  onSuggest: (s: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-iris-primary text-primary-foreground"
            : "border-border bg-card text-foreground border",
        ].join(" ")}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <IrisMarkdown text={message.content} streaming={message.streaming ?? false} />
        )}
        {!isUser && !message.streaming && message.toolCount !== undefined && (
          <div className="mt-2 flex items-center gap-2 border-t border-current/10 pt-2 text-xs opacity-60">
            <span>
              {message.toolCount} tool call{message.toolCount !== 1 ? "s" : ""}
            </span>
            {message.guardPassed !== undefined && (
              <span>{message.guardPassed ? "· citations verified" : "· citation warning"}</span>
            )}
          </div>
        )}
      </div>
      {!isUser && !message.streaming && message.suggestions && message.suggestions.length > 0 && (
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
    </div>
  );
}

function IrisMarkdown({ text, streaming }: { text: string; streaming?: boolean }) {
  const displayText = streaming ? stripSuggestionsForStream(text) : text;
  const processed = applyIrisMarkers(displayText);

  if (!processed && streaming) {
    return <span className="iris-cursor" />;
  }

  return (
    <span className={streaming ? "iris-cursor" : undefined}>
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
            return (
              <pre
                style={{
                  backgroundColor: "var(--bg-elev)",
                  padding: "12px 16px",
                  borderRadius: "4px",
                  overflowX: "auto",
                  marginBottom: "12px",
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "0.875rem",
                  color: "var(--text)",
                  whiteSpace: "pre",
                }}
              >
                {children}
              </pre>
            );
          },
          code({ children, className }) {
            const isBlock = Boolean(className);
            const raw = String(children ?? "");
            const html = applyIrisMarkers(raw);
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
    </span>
  );
}
