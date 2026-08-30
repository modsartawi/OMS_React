# oms-react — agent guide

React rebuild of the OMS back-office portal. Orientation for agent sessions; the README is the
human-facing overview.

## Stack

react 19 · vite 8 · TypeScript · react-router 8 (data mode) · TanStack Query · zustand ·
tailwind 4 + shadcn tokens · react-i18next (en-only, zero-literal) · AG Grid Community · sonner ·
lucide. Package manager is **npm** (not pnpm — see README). Path alias `@/` → `src/`.

## Working in this repo

**Batch exploration — budget the round trips, not the reading.** Read as much of the repo as you
need; under-reading is a worse failure than a slow session, and nothing here caps how much you look
at. What is capped is the number of *calls* you spend looking. One Bash call may carry many reads —
`cat a.tsx b.tsx; sed -n '1,80p' c.ts; grep -n X d.ts` is ONE call, and it puts more context in front
of you in a single view than four calls do, so it is usually the better read as well as the faster
one. Batch by default; a lone single-file read is the exception. Before a third consecutive
single-file read, batch the next ten into one call. Genuinely sequential reads are fine — when file A
tells you which file B to open, you could not have batched them; never *guess* at B to save a call.

Measured on a comparable C# wave: ~93 one-line reads per session, ~15 of every ~40 minutes of
wall-clock, nearly all of them batchable. Exploration round trips, not builds or tests, dominate a
long slice.

**Delegate wide searches, keep judgement.** If answering a question means sweeping many files or
guessing at naming conventions ("where is this route registered", "what else uses this hook"), spawn
one `Explore` subagent and keep its conclusion rather than walking the tree file by file. Do not
delegate a question you must reason over in detail — a subagent returns a summary and the raw detail
is lost. Correctness judgements, rules compliance and diff review stay yours.

## Commands

- `npm run dev` — Vite dev server on :5173, proxies `/api` → SIS.Api on :5111.
- `npm run typecheck` — `tsc --noEmit`. Run this regularly; it is the fast feedback loop.
- `npm run build` — typecheck + static `dist/`.
- `npm run lint` — three gates: import boundaries, token contrast, colour literals.
- `npm test` — **vitest** (`vitest run`, `src/**/*.test.ts`, node environment). Bootstrapped by
  ticket 090; config in `vitest.config.ts`, deliberately separate from `vite.config.ts`.
  **React Testing Library is still not installed** (spec 083's ruling: the pure modules are where
  regression is silent, the components are thin renderers) — so a component or screen slice is still
  verified by driving the app, and RTL remains the hardening ticket's to add.
- Playwright **drives** live under `tools/*-drive.mjs` (plus the `tools/screen1-smoke.mjs` smoke).
  They are manual-run tools, not CI gates: `npx vite --port 5199` in one shell, `node tools/<x>.mjs`
  in another. `/tdd` and `/implement` verify a UI slice with one of these plus `typecheck`.

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
