# Agent Instructions

At the start of each new chat, read `contract.md` exactly once before making repo changes or giving implementation guidance.

After that initial read, do not reread `contract.md` unless one of these is true:
- New context is required to answer safely.
- The user asks for architecture, API, build, trading, broker, AI, or persistence details.
- You are about to change behavior that may affect trading, risk gates, credentials, persistence, or deployment.
- `contract.md` may be stale because relevant source files changed.

When source behavior changes, update `contract.md` in the same turn so future agents inherit the current system contract. Do not use `contract.md` as a changelog: only revise it when features, logic, APIs, data models, environment variables, safety rules, scripts, or build/runtime behavior are added, removed, or materially changed. Keep it describing the current build state.

Operational rules:
- Do not print, log, commit, or expose secrets from `.env`.
- Treat Alpaca as paper-only unless the user explicitly requests a live-trading redesign and the safety model is updated first.
- Preserve the invariant that OpenAI cannot override deterministic RSI or risk gates.
- Prefer small, testable changes that follow existing patterns.
- Before modifying trading logic, read the current implementation in `lib/bot`, `lib/strategy`, `lib/ai`, `lib/broker`, and `prisma/schema.prisma`.
- Run focused verification after edits. Use `npm run test`, `npm run lint`, and `npm run build` when behavior or types change.
