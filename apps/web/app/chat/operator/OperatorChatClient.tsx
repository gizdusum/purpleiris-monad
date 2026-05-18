"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { IrisResponse } from "@purpleiris/iris-agent";
import IrisBackdrop from "@/components/IrisBackdrop";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
  toolCount?: number;
};

const SUGGESTED = [
  "What's the network's Nakamoto coefficient?",
  "Compare commission rates: F5 Nodes vs Chorus One",
  "Which validators have a success rate below 95% this month?",
  "Show me AltLayer's block production history.",
  "What's the stake distribution across the top 20 validators?",
];

export function OperatorChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.text,
        toolCount: data.tool_calls.length,
      };
      setMessages([...history, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
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
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: "color-mix(in srgb, var(--cat-operator) 10%, transparent)",
            color: "var(--cat-operator)",
          }}
        >
          Live
        </span>
      </header>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto" style={{ position: "relative", zIndex: 1 }}>
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <p className="text-foreground mb-2 text-2xl font-bold">Operator diagnostics.</p>
            <p className="text-muted-foreground mb-8 max-w-sm text-sm">
              On-chain validator data, block production history, network metrics. Telemetry ships in
              v1.5.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="border-border bg-card hover:border-iris-primary text-muted-foreground hover:text-foreground rounded-xl border px-3 py-2 text-left text-xs transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
            {messages.map((m) => (
              <OperatorMessageBubble key={m.id} message={m} />
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
          className="border-border bg-card mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border px-4 py-3 focus-within:ring-2"
          style={
            {
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
    </div>
  );
}

function OperatorMessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
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
    </div>
  );
}

function IrisMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
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
              }}
            >
              {children}
            </pre>
          );
        },
        code({ children, className }) {
          const isBlock = Boolean(className);
          if (isBlock) {
            return (
              <code
                className={className}
                style={{ fontFamily: "var(--font-mono), monospace", color: "var(--text)" }}
              >
                {children}
              </code>
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
            >
              {children}
            </code>
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
      {text}
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
