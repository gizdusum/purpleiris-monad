<!-- BEGIN:purpleiris-v2-agent-rules -->

# PurpleIris v2 — Agent Rules

## Repository structure

This is a pnpm monorepo managed by Turborepo.

```
apps/web          Next.js 14 frontend (Vercel)
apps/daemon       Vault rebalancer TypeScript worker (VPS)
packages/shared-types     Cross-package TypeScript types
packages/monad-indexer    Monad on-chain reads (viem + staking precompile)
packages/iris-agent       Anthropic SDK agent, tool defs, guardrails
packages/telemetry-ingest HMAC-verifying ingestion endpoint (VPS)
packages/ui               shadcn-based component library
contracts/        Foundry vault contracts (testnet only)
telemetry-agent/  Go binary for validator operators
deploy/           Docker Compose, systemd units, nginx configs, GitHub Actions
legacy/           Read-only salvaged v1 source — reference only, do NOT import
docs/             Persona, methodology, operator guide
```

## Critical constraints

1. **`legacy/` is READ-ONLY.** Never import from it. Never modify it. Reference only.
2. **`gizdusum/arcana` is OFF-LIMITS.** No commits, PRs, or modifications. No runtime calls.
3. **Testnet validator node is OFF-LIMITS.** Never install anything on it, never reference its RPC.
4. **Vault contracts stay on testnet** until external audit + explicit mainnet deploy decision.
5. **English only.** No i18n, no locale routing, no translation files.
6. **No mainnet wallet signing in the build** except Mode 3 vault deposit/withdraw.
7. **`ANTHROPIC_API_KEY` is server-side only.** Never `NEXT_PUBLIC_*`.

## Next.js

The web app is Next.js 14 (App Router). Before writing any page or API route:
read the relevant section in `node_modules/next/dist/docs/` if available.
Key conventions: async params, async cookies/headers, no `export const runtime = 'edge'` by default.

## Data class labeling

Every Iris response must tag each factual claim with its data class:

- Class 1 — on-chain (deterministic)
- Class 2 — derived (formula-dependent, version pinned)
- Class 3 — estimated (uncertainty-aware, range or confidence interval required)

See `docs/iris-persona.md` and `docs/methodology.md` for the full spec.

## Credential discipline

When a build step requires an external credential, STOP and issue a CREDENTIAL REQUEST block.
Do not invent placeholder values. Do not continue past the credential gate.
See §12 of the build brief for the exact format.

<!-- END:purpleiris-v2-agent-rules -->
