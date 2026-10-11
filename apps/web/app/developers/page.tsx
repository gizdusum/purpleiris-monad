import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { getPublicToolCatalog, SERVER_INFO, LATEST_PROTOCOL_VERSION } from "@purpleiris/iris-agent";
import LiveConsole from "@/components/LiveConsole";

export const metadata: Metadata = {
  title: "API & MCP",
  description:
    "Use PurpleIris from your own app or agent: a Model Context Protocol server and a REST API over Monad validator and staking data. Read-only, no key required.",
};

const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://purpleiris.live").replace(/\/+$/, "");
const REPO = "https://github.com/gizdusum/purpleiris-monad";
const mono = "var(--font-mono), monospace";

const h2: CSSProperties = {
  color: "var(--text)",
  fontSize: "1.35rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  margin: "56px 0 12px",
};
const p: CSSProperties = {
  color: "var(--text-dim)",
  fontSize: "14px",
  lineHeight: 1.7,
  margin: "0 0 14px",
};

function Code({ children }: { children: string }) {
  return (
    <pre
      tabIndex={0}
      style={{
        margin: "0 0 16px",
        padding: "14px 16px",
        overflowX: "auto",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        background: "rgba(0,0,0,.3)",
        color: "var(--text)",
        fontFamily: mono,
        fontSize: "12px",
        lineHeight: 1.6,
      }}
    >
      {children}
    </pre>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontFamily: mono,
        fontSize: "11px",
        letterSpacing: ".32em",
        textTransform: "uppercase",
        color: "var(--accent)",
        margin: "0 0 12px",
      }}
    >
      {children}
    </p>
  );
}

const cell: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
  verticalAlign: "top",
  textAlign: "left",
};

export default function DevelopersPage() {
  const tools = getPublicToolCatalog();

  return (
    <>
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          borderBottom: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "rgba(7,6,26,0.7)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Link
          href="/"
          className="text-sm uppercase tracking-wider"
          style={{ fontWeight: 500, textDecoration: "none" }}
        >
          <span style={{ color: "var(--accent)" }}>|</span>
          <span style={{ color: "var(--text)" }}>PURPLEIRIS</span>
        </Link>
        <nav className="flex items-center gap-1 text-xs uppercase tracking-wider">
          <Link href="/methodology" className="iris-nav-link">
            DOCS
          </Link>
          <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>·</span>
          <span style={{ color: "var(--accent)", fontWeight: 600, fontFamily: mono }}>API</span>
          <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>·</span>
          <a href={REPO} target="_blank" rel="noopener noreferrer" className="iris-nav-link">
            GITHUB
          </a>
          <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>·</span>
          <Link href="/status" className="iris-nav-link">
            STATUS
          </Link>
        </nav>
      </header>

      <main style={{ padding: "96px 24px 80px" }}>
        <div style={{ maxWidth: "820px", margin: "0 auto" }}>
          <Eyebrow>API &amp; MCP</Eyebrow>
          <h1
            style={{
              color: "var(--text)",
              fontSize: "clamp(1.875rem, 5vw, 3rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              margin: "0 0 18px",
            }}
          >
            Monad validator data
            <br />
            for your app or agent
          </h1>
          <p style={{ ...p, fontSize: "15px", maxWidth: "640px" }}>
            The {tools.length} tools behind the PurpleIris assistant are available directly: as a{" "}
            <strong style={{ color: "var(--text)" }}>Model Context Protocol server</strong> for AI
            agents and as a <strong style={{ color: "var(--text)" }}>REST API</strong> for
            everything else. Read-only, no key, and every response carries the same data-class label
            the assistant uses.
          </p>

          <h2 style={h2}>Try it</h2>
          <p style={p}>
            These run real requests from your browser. The first one reads the validator set
            straight from the staking precompile and returns the block it was read at.
          </p>
          <LiveConsole />

          <h2 style={h2}>Connect over MCP</h2>
          <p style={p}>
            Streamable HTTP transport, stateless, protocol version {LATEST_PROTOCOL_VERSION}. Point
            any MCP client that supports remote HTTP servers at:
          </p>
          <Code>{`${BASE}/api/mcp`}</Code>
          <p style={p}>Claude Code:</p>
          <Code>{`claude mcp add --transport http purpleiris ${BASE}/api/mcp`}</Code>
          <p style={p}>Clients configured with JSON:</p>
          <Code>{`{
  "mcpServers": {
    "purpleiris": { "type": "http", "url": "${BASE}/api/mcp" }
  }
}`}</Code>
          <p style={p}>Or speak JSON-RPC to it yourself:</p>
          <Code>{`curl -s ${BASE}/api/mcp \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"get_onchain_snapshot","arguments":{"top_n":3}}}'`}</Code>

          <h2 style={h2}>REST</h2>
          <p style={p}>
            One endpoint per tool. <code>POST</code> a JSON body, or <code>GET</code> with query
            parameters. The catalog and an OpenAPI 3.1 document are generated from the same tool
            definitions the assistant uses.
          </p>
          <Code>{`# list tools and their JSON Schemas
curl -s ${BASE}/api/v1/tools

# call one
curl -s '${BASE}/api/v1/tools/estimate_stake_reward?stake_mon=10000&days=90'

curl -s ${BASE}/api/v1/tools/get_validator \\
  -H 'content-type: application/json' -d '{"id":"backpack"}'

# OpenAPI
curl -s ${BASE}/api/v1/openapi.json`}</Code>

          <h2 style={h2}>What comes back</h2>
          <p style={p}>
            Every tool returns the same envelope. Over MCP it is the <code>structuredContent</code>{" "}
            of the result.
          </p>
          <Code>{`{
  "tool": "get_onchain_snapshot",
  "data": { "as_of_block": 112474748, "epoch": 2250, "...": "..." },
  "data_class": 1,
  "data_class_label": "Class 1 — on-chain (deterministic)",
  "source": "get_onchain_snapshot",
  "timestamp": "2026-10-11T13:20:00.000Z",
  "freshness": { "indexed_at": "…", "age_hours": 1.2, "stale": false },
  "methodology_url": "${BASE}/methodology"
}`}</Code>
          <ul style={{ ...p, paddingLeft: "18px", listStyle: "disc" }}>
            <li>
              <code>data_class</code> — 1 read from chain, 2 derived by a stated formula, 3 an
              estimate. Defined on the <Link href="/methodology">methodology</Link> page.
            </li>
            <li>
              <code>freshness</code> — present on tools that read the indexer&apos;s tables. If{" "}
              <code>stale</code> is true the data is older than one and a half indexer cycles; show{" "}
              <code>indexed_at</code> to your user instead of calling it current.
            </li>
            <li>
              <code>as_of_block</code> — on the live snapshot, the block every value was read at, so
              the result can be reproduced against any Monad RPC.
            </li>
          </ul>

          <h2 style={h2}>Tools</h2>
          <div
            style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "10px" }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12.5px",
                color: "var(--text-dim)",
              }}
            >
              <thead>
                <tr style={{ fontFamily: mono, fontSize: "10px", letterSpacing: ".16em" }}>
                  <th style={{ ...cell, color: "var(--text-mute)" }}>TOOL</th>
                  <th style={{ ...cell, color: "var(--text-mute)" }}>WHAT IT RETURNS</th>
                  <th style={{ ...cell, color: "var(--text-mute)" }}>ARGUMENTS</th>
                  <th style={{ ...cell, color: "var(--text-mute)" }}>SOURCE</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((t) => {
                  const args = Object.keys(t.inputSchema.properties);
                  return (
                    <tr key={t.name}>
                      <td
                        style={{
                          ...cell,
                          fontFamily: mono,
                          color: "var(--text)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.name}
                      </td>
                      <td style={cell}>{t.title}</td>
                      <td style={{ ...cell, fontFamily: mono, fontSize: "11.5px" }}>
                        {args.length === 0
                          ? "—"
                          : args
                              .map((a) => (t.inputSchema.required.includes(a) ? a : `${a}?`))
                              .join(", ")}
                      </td>
                      <td style={{ ...cell, whiteSpace: "nowrap" }}>
                        {t.backing === "chain"
                          ? "live chain read"
                          : t.backing === "index"
                            ? "indexer"
                            : "formula"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h2 style={h2}>Limits and ground rules</h2>
          <ul style={{ ...p, paddingLeft: "18px", listStyle: "disc" }}>
            <li>60 requests per minute per IP. A 429 response includes Retry-After.</li>
            <li>Read-only. No endpoint signs, sends or holds anything.</li>
            <li>
              Non-advisory. The API reports data; it does not rank validators for you, and Class 3
              values are estimates with stated weaknesses, not promises.
            </li>
            <li>
              Open source under the MIT license:{" "}
              <a
                href={REPO}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent-hover)" }}
              >
                {REPO.replace("https://", "")}
              </a>
              .
            </li>
          </ul>

          <p
            style={{
              ...p,
              fontFamily: mono,
              fontSize: "11px",
              color: "var(--text-mute)",
              marginTop: "40px",
            }}
          >
            {SERVER_INFO.name} {SERVER_INFO.version}
          </p>
        </div>
      </main>
    </>
  );
}
