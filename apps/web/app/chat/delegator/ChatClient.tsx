"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import type { IrisResponse } from "@purpleiris/iris-agent";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
  guardPassed?: boolean;
  toolCount?: number;
};

const SUGGESTED = [
  "What are the active validators on Monad right now?",
  "What's the Nakamoto coefficient of the network?",
  "Which validators have the lowest commission and highest reliability?",
  "If I stake 1000 MON with Chorus One for 30 days, what reward can I expect?",
  "How diverse would a split between Chorus One and Figment be?",
];

export function ChatClient() {
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
      const res = await fetch("/api/chat/delegator", {
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
        guardPassed: data.guard_passed,
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
    <div className="bg-background flex h-screen flex-col">
      {/* Header */}
      <header className="border-border flex items-center justify-between border-b px-4 py-3">
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
        <span className="bg-iris-primary/10 text-iris-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
          Live
        </span>
      </header>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <p className="font-heading text-foreground mb-2 text-2xl font-bold">
              What would you like to know?
            </p>
            <p className="text-muted-foreground mb-8 max-w-sm text-sm">
              Ask me about any Monad validator — commission, performance, decentralization, or
              projected rewards.
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
              <MessageBubble key={m.id} message={m} />
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
      <div className="border-border border-t px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="border-border bg-card focus-within:ring-iris-primary/40 mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border px-4 py-3 focus-within:ring-2"
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
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
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
          <IrisMarkdown text={message.content} />
        )}
        {!isUser && message.toolCount !== undefined && (
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
    </div>
  );
}

function IrisMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith("## "))
          return (
            <p key={i} className="font-heading mt-3 text-base font-bold first:mt-0">
              {line.slice(3)}
            </p>
          );
        if (line.startsWith("### "))
          return (
            <p key={i} className="mt-2 font-semibold first:mt-0">
              {line.slice(4)}
            </p>
          );
        if (line.startsWith("- ") || line.startsWith("• "))
          return (
            <p key={i} className="flex gap-2">
              <span className="shrink-0 opacity-50">·</span>
              <span>{line.slice(2)}</span>
            </p>
          );
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return (
          <p key={i} className="whitespace-pre-wrap">
            {line}
          </p>
        );
      })}
    </div>
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
              className="bg-iris-primary h-1.5 w-1.5 animate-bounce rounded-full"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
        <span className="text-muted-foreground text-xs">Iris is thinking…</span>
      </div>
    </div>
  );
}
