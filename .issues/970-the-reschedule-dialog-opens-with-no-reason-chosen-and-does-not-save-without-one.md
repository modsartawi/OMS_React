---
status: open
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

- [ ] `reschedule-model.test.ts` — no reason is chosen on open, and save is off until one is · vitest (`npm test`)
- [ ] `tools/reschedule-drive.mjs` — open the dialog, try to save, choose a reason, save · Playwright drive, run by hand against stubs

## Boundaries

Deploy before the server refusal.

## Done when

The model test is green and the drive passes.

## Blocked by

None — can start immediately
