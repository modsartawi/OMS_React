---
name: tdd
description: Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", or wants integration tests.
---

# Test-Driven Development

TDD is the red → green loop. This skill is the reference that makes that loop produce tests worth keeping: what a good test is, where tests go, the anti-patterns, and the rules of the loop. Every section applies on every cycle — consult them before and during the loop, not after.

When exploring the codebase, read `CONTEXT.md` so test names and interface vocabulary match the project's domain language, and respect ADRs (`docs/adr/`) and `.claude/rules/` in the area you're touching.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification — a name like `switchStore_updates_acting_store_and_toasts` tells you exactly what capability exists — and survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Seams — where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against internals. Prefer **deep** seams — a small public surface hiding a real implementation beats many shallow entry points, and it's the seam that survives refactors.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and confirm them with the user. No test is written at an unconfirmed seam. You can't test everything — agreeing the seams up front is how testing effort lands on the critical paths and complex logic instead of every edge case.

Ask: "What's the public interface, and which seams should we test?"

In this repo the usual seams, highest first:

- **Pure module** (in-memory) — a reducer, a query builder (`features/deliveries/filter.ts`), a formatter (`core/util/*`), a zustand store's action (`core/session.ts`). No DOM, no network. Where most logic is designed and proven.
- **Component** (React Testing Library) — render a component, act as a user (click, type), assert on what's on screen. Stub the network at the `api.ts` boundary. For the behavior a screen promises.
- **Flow** (Playwright) — drive the real app against a running SIS.Api (or a stub), like `tools/screen1-smoke.mjs`. Reserve for end-to-end paths a single component can't prove (login → screen, 401 redirect).

Agreeing the seam also decides the **tier** (see Project stack below). Prefer the highest pure seam that can observe the behavior.

## Anti-patterns

- **Implementation-coupled** — mocks internal collaborators, tests private helpers, asserts a component called a specific function, or reaches into zustand state instead of observing rendered output. The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological** — the assertion recomputes the expected value the way the code does (re-running `buildDeliveryQuery` to assert the query, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction. Expected values must come from an independent source of truth — a known-good literal, a worked example, the spec. Example in [tests.md](tests.md).
- **Horizontal slicing** — writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead — one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

```
WRONG (horizontal):  RED: test1..test5   then   GREEN: impl1..impl5
RIGHT (vertical):    RED→GREEN test1→impl1, then test2→impl2, ...
```

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** It belongs to the review stage (see the `standards-review` skill), not the red → green implementation cycle.

## Project stack

The test runner (**vitest** + **React Testing Library** for unit/component, **Playwright** for flow) is the intended stack but is **not installed yet** — deferred to the hardening ticket (README). Two consequences:

- **If the runner is already in `package.json`** (check first): red-green normally. Pure/component tests as `*.test.ts` / `*.test.tsx` beside the module; Playwright flows under `tools/` alongside `screen1-smoke.mjs`. Expected values are independent literals; stub the network at the `api.ts` boundary ([mocking.md](mocking.md)), never deeper.
- **If it is not yet installed** and this slice needs its first test, that is a real seam decision, not a detour — **stop and agree it with the user**: either bootstrap vitest/RTL now (add the dev deps + a `test` script, smallest config that runs one file) as part of the slice, or, if the user defers, fall back to the honest substitutes — `npm run typecheck` for type-level guarantees and **driving the app** (`npm run dev`, or extend the Playwright smoke) to observe the behavior. Record which you did in the ticket's Proof. Don't silently skip the red step.

The fast inner loop regardless of tier is `npm run typecheck` — run it continuously; it catches the largest class of errors in a typed React codebase before any test does.
