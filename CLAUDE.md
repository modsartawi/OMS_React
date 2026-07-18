# oms-react — agent guide

React rebuild of the OMS back-office portal. Orientation for agent sessions; the README is the
human-facing overview.

## Stack

react 19 · vite 8 · TypeScript · react-router 8 (data mode) · TanStack Query · zustand ·
tailwind 4 + shadcn tokens · react-i18next (en-only, zero-literal) · AG Grid Community · sonner ·
lucide. Package manager is **npm** (not pnpm — see README). Path alias `@/` → `src/`.

## Commands

- `npm run dev` — Vite dev server on :5173, proxies `/api` → SIS.Api on :5111.
- `npm run typecheck` — `tsc --noEmit`. Run this regularly; it is the fast feedback loop.
- `npm run build` — typecheck + static `dist/`.
- Tests (vitest / RTL / Playwright) are **not installed yet** — deferred to the hardening ticket.
  The one live check is the Playwright smoke at `tools/screen1-smoke.mjs`. Until the runner lands,
  `/tdd` and `/implement` verify by driving the app and by `typecheck` (see the `tdd` skill).

## Conventions — `.claude/rules/`

Standing coding rules every change respects. Read the ones touching your area:

- [feature-structure](.claude/rules/feature-structure.md) — `features/<area>/<feature>/` layout, area taxonomy, import boundaries (features never import features; only `app`+`layout` reach in), the add-a-feature checklist.
- [i18n-zero-literal](.claude/rules/i18n-zero-literal.md) — no user-visible string literals; always `t()`.
- [logical-tailwind](.claude/rules/logical-tailwind.md) — logical utilities (`ms/pe/text-start`), never `ml/pr/left`.
- [api-envelope](.claude/rules/api-envelope.md) — all server calls through `src/core/api.ts`.

## Domain language

`CONTEXT.md` is the glossary (delivery document, store, session, envelope, guardrail refusal).
Use its vocabulary in code, tickets, and specs. `/domain-modeling` maintains it.

## Planning & build workflow — `.claude/skills/`

Idea → shipped follows the skill chain, all reading `docs/agents/issue-tracker.md` (the local
`.issues/` tracker):

`/wayfinder` (chart a big effort) → `/to-spec` (synthesize a spec) → `/to-tickets` (slice into
tracer-bullet tickets) → `/implement` (build one ticket, red-green via `/tdd`) →
`/standards-review` (rules + spec fidelity). Supporting: `/grilling`, `/prototype`, `/research`,
`/domain-modeling`. The built-in `/code-review` covers correctness bugs; `/standards-review`
covers convention/spec fidelity — run both.
