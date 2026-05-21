"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import IrisBackdrop from "@/components/IrisBackdrop";
import { AddressModal } from "@/components/AddressModal";
import { IrisMarkdown } from "@/components/IrisMarkdown";
import { FeedbackModal } from "@/components/FeedbackModal";
import { parseSuggestions } from "@/lib/iris-markdown";
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

type GreetingStage = "join" | "typing" | "streaming" | "done";

const DELEGATOR_GREETING_FULL = `Hey 👋 I'm Hermes — your messenger from the Monad chain.

Running or delegating? Drop a validator's address or moniker, or pick a query below.`;

const THINKING_PHRASES = [
  "Hermes is reading the chain",
  "Pulling validator data",
  "Cross-referencing metrics",
] as const;

// Chip sets
const CHIPS_NETWORK = [
  "Show me the network overview",
  "Top 5 validators by reliability",
  "Find clean validators with low commission",
];
const CHIPS_COMPARE = [
  "Compare two validators side by side",
  "Which validators are safest for long-term staking?",
];
const CHIPS_SIMULATE = ["What would I earn delegating 1000 MON?"];

function getPostValidatorChips(moniker: string) {
  return [
    `Show me ${moniker}'s full profile`,
    `Walk me through ${moniker}'s risk signals`,
    `What would I earn delegating to ${moniker}?`,
  ];
}

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
  const [cachedConversation, setCachedConversation] = useState<Message[] | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remembered, setRemembered] = useState<RememberedValidator | null>(null);
  const [modal, setModal] = useState<{ pending: string } | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Greeting animation state
  const [greetingStage, setGreetingStage] = useState<GreetingStage>("join");
  const [greetingText, setGreetingText] = useState("");
  const [greetingTime, setGreetingTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
  );
  const greetingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const greetingRafRef = useRef<number | null>(null);

  // Thinking phase state
  const [thinkingPhase, setThinkingPhase] = useState<0 | 1 | 2 | null>(null);
  const thinkingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = messages.length === 0;

  useEffect(() => {
    setRemembered(getRemembered());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Greeting animation: runs whenever the empty state appears
  useEffect(() => {
    if (!isEmpty) return;
    // Clear any previous animation
    greetingTimersRef.current.forEach(clearTimeout);
    if (greetingRafRef.current) cancelAnimationFrame(greetingRafRef.current);
    setGreetingStage("join");
    setGreetingText("");
    setGreetingTime(
      new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
    );

    const t1 = setTimeout(() => setGreetingStage("typing"), 700);
    const t2 = setTimeout(() => setGreetingStage("streaming"), 2200);
    greetingTimersRef.current = [t1, t2];

    return () => {
      [t1, t2].forEach(clearTimeout);
      if (greetingRafRef.current) cancelAnimationFrame(greetingRafRef.current);
    };
  }, [isEmpty]);

  // RAF loop: advance greeting text when stage is "streaming"
  useEffect(() => {
    if (greetingStage !== "streaming") return;
    if (greetingText.length >= DELEGATOR_GREETING_FULL.length) {
      setGreetingStage("done");
      return;
    }
    greetingRafRef.current = requestAnimationFrame(() => {
      setGreetingText((prev) => {
        const gap = DELEGATOR_GREETING_FULL.length - prev.length;
        const step = Math.max(1, Math.min(5, Math.ceil(gap / 15)));
        return DELEGATOR_GREETING_FULL.slice(0, prev.length + step);
      });
    });
    return () => {
      if (greetingRafRef.current) cancelAnimationFrame(greetingRafRef.current);
    };
  }, [greetingStage, greetingText]);

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

    // Start thinking phase
    setThinkingPhase(0);
    const tp1 = setTimeout(() => setThinkingPhase(1), 3000);
    const tp2 = setTimeout(() => setThinkingPhase(2), 7000);
    thinkingTimersRef.current = [tp1, tp2];

    const assistantId = crypto.randomUUID();
    setMessages([...history, { id: assistantId, role: "assistant", content: "", streaming: true }]);

    let firstToken = true;

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
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

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
            // Clear thinking phase on first token
            if (firstToken) {
              firstToken = false;
              thinkingTimersRef.current.forEach(clearTimeout);
              thinkingTimersRef.current = [];
              setThinkingPhase(null);
            }
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
      thinkingTimersRef.current.forEach(clearTimeout);
      setThinkingPhase(null);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
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

  function handleBack() {
    if (messages.length === 0) return;
    setCachedConversation(messages);
    setMessages([]);
  }

  function handleForward() {
    if (!cachedConversation || cachedConversation.length === 0) return;
    setMessages(cachedConversation);
    setCachedConversation(null);
  }

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
            <p className="text-foreground text-sm font-semibold">Hermes — Delegator Mode</p>
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
          <div className="mx-auto px-4 py-6" style={{ maxWidth: "920px" }}>
            {/* Stage 1: channel join event */}
            <div className="iris-channel-event">
              <span className="iris-channel-event-time">[{greetingTime}]</span>
              {"  "}
              <span className="iris-channel-event-name">Hermes</span>
              {" joined the channel"}
            </div>

            {/* Stage 2: typing indicator */}
            {(greetingStage === "typing" ||
              greetingStage === "streaming" ||
              greetingStage === "done") &&
              (greetingStage === "typing" ? (
                <div className="iris-typing-indicator iris-thinking-text">Hermes is typing</div>
              ) : (
                /* Stage 3 & 4: greeting bubble streaming then done */
                <div className="mt-2 flex flex-col items-start">
                  <div className="border-border bg-card text-foreground max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-relaxed">
                    <p style={{ whiteSpace: "pre-line" }}>
                      {greetingText}
                      {greetingStage === "streaming" && <span className="iris-stream-cursor" />}
                    </p>
                  </div>
                </div>
              ))}

            {/* Stage 4: chips */}
            {greetingStage === "done" && (
              <div className="mt-6">
                {remembered ? (
                  <>
                    <p className="iris-ghost-pill-group-label">ANALYZE</p>
                    <div className="flex flex-wrap gap-2">
                      {getPostValidatorChips(remembered.moniker ?? remembered.address).map((q) => (
                        <button key={q} onClick={() => void send(q)} className="iris-ghost-pill">
                          {q}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="iris-ghost-pill-group-label">NETWORK</p>
                    <div className="flex flex-wrap gap-2">
                      {CHIPS_NETWORK.map((q) => (
                        <button key={q} onClick={() => void send(q)} className="iris-ghost-pill">
                          {q}
                        </button>
                      ))}
                    </div>
                    <p className="iris-ghost-pill-group-label">COMPARE</p>
                    <div className="flex flex-wrap gap-2">
                      {CHIPS_COMPARE.map((q) => (
                        <button key={q} onClick={() => void send(q)} className="iris-ghost-pill">
                          {q}
                        </button>
                      ))}
                    </div>
                    <p className="iris-ghost-pill-group-label">SIMULATE</p>
                    <div className="flex flex-wrap gap-2">
                      {CHIPS_SIMULATE.map((q) => (
                        <button key={q} onClick={() => void send(q)} className="iris-ghost-pill">
                          {q}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Forward button */}
            {cachedConversation && cachedConversation.length > 0 && (
              <div className="iris-nav-row iris-nav-row-empty-state">
                <button
                  onClick={handleForward}
                  className="iris-forward-btn"
                  aria-label="Restore previous conversation"
                >
                  → Resume previous chat
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto space-y-6 px-4 py-6" style={{ maxWidth: "920px" }}>
            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                message={m}
                isLast={i === messages.length - 1}
                onSuggest={(s) => void send(s)}
                onBack={handleBack}
                thinkingPhase={thinkingPhase}
              />
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
            placeholder="Ask Hermes about validators…"
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
          Hermes does not provide financial advice.{" "}
          <button
            onClick={() => setFeedbackOpen(true)}
            className="text-iris-primary cursor-pointer border-0 bg-transparent underline underline-offset-2"
          >
            Send feedback
          </button>
        </p>
      </div>

      <AddressModal
        open={modal !== null}
        onClose={() => setModal(null)}
        onSubmit={handleModalSubmit}
      />
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        mode="delegator"
        lastAssistantContent={[...messages].reverse().find((m) => m.role === "assistant")?.content}
        validatorIdentifier={remembered?.moniker ?? remembered?.address}
      />
    </div>
  );
}

function MessageBubble({
  message,
  isLast,
  onSuggest,
  onBack,
  thinkingPhase,
}: {
  message: Message;
  isLast: boolean;
  onSuggest: (s: string) => void;
  onBack: () => void;
  thinkingPhase: 0 | 1 | 2 | null;
}) {
  const isUser = message.role === "user";
  const showBack = !isUser && isLast && !message.streaming;
  const showThinking =
    !isUser && (message.streaming ?? false) && message.content === "" && thinkingPhase !== null;

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
        ) : showThinking ? (
          <span
            className="iris-thinking-text"
            style={{
              color: "rgba(226,232,240,0.4)",
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.875rem",
            }}
          >
            {THINKING_PHRASES[thinkingPhase ?? 0]}
          </span>
        ) : (
          <IrisMarkdown
            text={message.content}
            streaming={message.streaming ?? false}
            stripSuggestions
          />
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
      {showBack && (
        <div className="iris-nav-row">
          <button
            onClick={onBack}
            className="iris-back-btn"
            aria-label="Clear conversation and return to home view"
          >
            ← Back to home
          </button>
        </div>
      )}
    </div>
  );
}
