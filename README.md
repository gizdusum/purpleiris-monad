# PurpleIris — v1.0 Hermes

**Monad's open intelligence layer for staking decisions, validator operations, and network decentralization.**

Every answer is grounded in on-chain data. Factual claims carry a data-class label (Class 1 / 2 / 3) and a source citation — never parametric guesswork.

---

## Modes

|     | Mode          | Route             | Status                         |
| --- | ------------- | ----------------- | ------------------------------ |
| 👤  | **Delegator** | `/chat/delegator` | Live — v1.0 Hermes             |
| 🛠  | **Operator**  | `/chat/operator`  | Live — v1.0 Hermes (read-only) |
| 🧪  | **Stake Sim** | —                 | Planned — v2.0 Pythia          |

Stake Sim ships in v2.0 Pythia with audited vault contracts. No route exists yet.

---

## Roadmap

| Version  | Codename   |
| -------- | ---------- |
| **v1.0** | **Hermes** |
| v1.1     | Athena     |
| v1.2     | Argus      |
| v1.3     | Mnemosyne  |
| v2.0     | Pythia     |

---

## Monorepo layout

```
apps/
  web/                Next.js 14 frontend → Vercel
  daemon/             TypeScript worker → Hostinger VPS
packages/
  shared-types/       Cross-package TypeScript types
  monad-indexer/      On-chain reads (viem, staking precompile)
  iris-agent/         Anthropic SDK agent + tool surface
  telemetry-ingest/   HMAC-verifying ingestion endpoint (TypeScript)
  ui/                 shadcn/ui primitives
deploy/               Docker Compose, systemd units, nginx configs
docs/                 Persona, methodology
legacy/               Salvaged v1 source — read-only reference
```

**Planned (v2.0 Pythia):**

- `contracts/` — Foundry vault contracts (directory reserved, no code yet)
- `telemetry-agent/` — Go telemetry binary (directory reserved, no code yet)

## Tech stack

| Layer            | Technology                                                             |
| ---------------- | ---------------------------------------------------------------------- |
| Frontend         | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui |
| LLM              | Anthropic SDK                                                          |
| Database         | Neon Postgres + Drizzle ORM                                            |
| Cache            | Upstash Redis                                                          |
| On-chain         | viem → Monad staking precompile (0x…1000)                              |
| Telemetry ingest | TypeScript endpoint (HMAC-verifying) → Hostinger VPS                   |
| VPS workloads    | Docker Compose + systemd + nginx + Let's Encrypt                       |

## Development

```bash
corepack enable
pnpm install
cp .env.example apps/web/.env.local
# fill in .env.local values
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
pnpm build
pnpm type-check
pnpm lint
```

## Deployment topology

| Service                | Host          | Subdomain                                |
| ---------------------- | ------------- | ---------------------------------------- |
| `apps/web`             | Vercel        | `purpleiris.live`, `www.purpleiris.live` |
| `monad-indexer` worker | Hostinger VPS | — (internal)                             |
| `telemetry-ingest`     | Hostinger VPS | `ingest.purpleiris.live`                 |
| `apps/daemon`          | Hostinger VPS | `daemon-admin.purpleiris.live`           |

## Data accuracy

Every factual response carries a data-class label:

- **Class 1 — On-chain** (deterministic, staking precompile)
- **Class 2 — Derived** (formula-dependent; all formulas published at `/methodology` with version pinning)
- **Class 3 — Estimated** (uncertainty-aware; always reported as a range with a known confidence interval)

## License

MIT
