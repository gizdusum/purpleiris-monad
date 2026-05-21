"use client";

import { useState, useRef, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { applyIrisMarkers, stripSuggestionsForStream } from "@/lib/iris-markdown";

// Split an incoming SSE chunk into word-sized render tokens.
// Newlines are emitted as standalone instant tokens; words carry trailing spaces.
function tokenize(chunk: string): string[] {
  return chunk
    .split(/(\n)/)
    .flatMap((seg) => {
      if (seg === "\n") return ["\n"];
      return seg.match(/\s*\S+\s*/g) ?? [];
    })
    .filter((t) => t.length > 0);
}

// Inter-word delay in ms — tuned so ~200 words ≈ 14-18 s.
function wordDelay(token: string): number {
  if (/^\s*$/.test(token)) return 0; // whitespace-only: instant
  const word = token.trim();
  if (word.length < 4) return 60;
  if (word.length > 10) return 120;
  return 80;
}

// ── Copy-button wrapper for fenced code blocks ──────────────────────────────
function CodeBlock({ code, className }: { code: string; className?: string | undefined }) {
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("ok");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      console.error("[IrisMarkdown] clipboard write failed — permission denied");
      setCopyState("err");
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  return (
    <div style={{ position: "relative", marginBottom: "12px" }}>
      <pre className="iris-code-block" style={{ marginBottom: 0 }}>
        <code
          className={className}
          style={{ fontFamily: "var(--font-mono), monospace", color: "var(--text)" }}
          dangerouslySetInnerHTML={{ __html: applyIrisMarkers(code) }}
        />
      </pre>
      <button
        onClick={() => void handleCopy()}
        title="Copy code"
        aria-label="Copy code to clipboard"
        className="iris-copy-btn"
      >
        {copyState === "ok" ? (
          <Check size={12} style={{ color: "#4ade80" }} />
        ) : copyState === "err" ? (
          <span style={{ fontSize: "11px", color: "#f87171" }}>✗</span>
        ) : (
          <Copy size={12} />
        )}
      </button>
    </div>
  );
}

// Stable ReactMarkdown overrides — defined outside component to avoid remount churn.
const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>["components"] = {
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
      <td style={{ padding: "8px 12px", border: "1px solid var(--border)", color: "var(--text)" }}>
        {children}
      </td>
    );
  },
  // pre passes through — CodeBlock renders its own <pre>
  pre({ children }) {
    return <>{children}</>;
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

    if (isBlock) {
      return <CodeBlock code={decoded} className={className} />;
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
        dangerouslySetInnerHTML={{ __html: applyIrisMarkers(decoded) }}
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
};

// ── Word-by-word streaming markdown renderer ─────────────────────────────────
export function IrisMarkdown({
  text,
  streaming,
  stripSuggestions = false,
}: {
  text: string;
  streaming?: boolean;
  stripSuggestions?: boolean;
}) {
  const [displayedText, setDisplayedText] = useState(streaming ? "" : text);
  const [cursorVisible, setCursorVisible] = useState(streaming ?? false);

  // Refs — all mutable state that the drain timer reads
  const queuedUpToRef = useRef(streaming ? 0 : text.length);
  const wordQueueRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStreamingRef = useRef(streaming ?? false);
  const latestTextRef = useRef(text);

  // Keep refs in sync with props every render
  useEffect(() => {
    isStreamingRef.current = streaming ?? false;
  }, [streaming]);
  useEffect(() => {
    latestTextRef.current = text;
  }, [text]);

  // Drain function — reassigned every render so it always reads fresh refs.
  // Called via drainRef.current() to avoid stale closure issues in setTimeout.
  const drainRef = useRef<() => void>(() => {});
  drainRef.current = function drain() {
    if (timerRef.current) return; // already scheduled
    const token = wordQueueRef.current.shift();
    if (token === undefined) {
      // Queue empty — if streaming ended, snap to final text and hide cursor
      if (!isStreamingRef.current) {
        setDisplayedText(latestTextRef.current);
        setCursorVisible(false);
      }
      return;
    }
    const delay = !isStreamingRef.current ? 20 : wordDelay(token);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setDisplayedText((prev) => prev + token);
      drainRef.current();
    }, delay);
  };

  // Enqueue new words as SSE chunks arrive (only while streaming)
  useEffect(() => {
    if (!streaming) return;
    if (text.length <= queuedUpToRef.current) return;
    const chunk = text.slice(queuedUpToRef.current);
    queuedUpToRef.current = text.length;
    wordQueueRef.current.push(...tokenize(chunk));
    drainRef.current();
  }, [text, streaming]);

  // When streaming ends: flush any remaining un-queued text then fast-drain
  useEffect(() => {
    if (streaming !== false) return;
    const finalText = latestTextRef.current;
    if (finalText.length > queuedUpToRef.current) {
      const chunk = finalText.slice(queuedUpToRef.current);
      queuedUpToRef.current = finalText.length;
      wordQueueRef.current.push(...tokenize(chunk));
    }
    // Start drain if idle (fast mode detected via isStreamingRef.current = false)
    drainRef.current();
  }, [streaming]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  // What to render: queue still running → displayedText, done → full text
  const shown = cursorVisible ? displayedText : text;
  const stripped = stripSuggestions && cursorVisible ? stripSuggestionsForStream(shown) : shown;
  const processed = applyIrisMarkers(stripped);

  if (!processed && cursorVisible) {
    return <span className="iris-stream-cursor" />;
  }

  return (
    <>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={MD_COMPONENTS}
      >
        {processed}
      </ReactMarkdown>
      {cursorVisible && <span className="iris-stream-cursor" />}
    </>
  );
}
