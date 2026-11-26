---
status: done
spec: BackOffice 4354
blocked-by: —
---

# 970 — The reschedule dialog opens with no reason chosen and does not save without one

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- The web reschedule dialog opens with no reason chosen and does not save a move without one, as the till does. Today a reason is already chosen when it opens.
- It shows the server's refusal when a move with no reason is sent.
- Ship this before the BackOffice ticket that makes the server refuse a move with no reason.

## Spine reach

oms-react: dialog / locales / tests

## Proof (→ `tdd` red-green cycles)

- [x] `reschedule-model.test.ts` — no reason is chosen on open, and save is off until one is · vitest (`npm test`)
- [x] `tools/reschedule-drive.mjs` — open the dialog, try to save, choose a reason, save · Playwright drive, run by hand against stubs

## Boundaries

Deploy before the server refusal.

## Done when

The model test is green and the drive passes.

## Blocked by

None — can start immediately

## Comments

**2026-11-27 — built.** `src/features/oms/document/reschedule-model.ts` (`seedReschedule` seeds the first
day and never a reason; `canSaveReschedule` needs the lists, a day, a time and a chosen reason) with
`reschedule-model.test.ts` (7 tests, red then green). `RescheduleDialog.tsx` uses both, shows a disabled
"Choose a reason" placeholder and a hint line until a reason is chosen. The server's refusal of a move is
toasted in its own words by the page's existing `notify.apiError` path; the drive proves it with a stubbed
400 (`RESCHEDULE_REASON_REQUIRED` is a placeholder code — BackOffice 4384 has not named it yet).

The drive found a reopen bug that predates this ticket: a reopen onto an unchanged slot list cleared the
time while the browser still showed the first window, so save stayed off. The time is now re-seeded on
every open. `tools/reschedule-drive.mjs`: 9/9 against the stubbed wire (`npx vite --port 5277` +
`DRIVE_PORT=5277 PLAYWRIGHT_CHANNEL=msedge node tools/reschedule-drive.mjs`; the channel variable is for a
machine without Playwright's own Chromium). `typecheck`, `npm test` and `lint` pass. Arabic keys not added:
`ar/document.json` has no `reschedule` block yet.
