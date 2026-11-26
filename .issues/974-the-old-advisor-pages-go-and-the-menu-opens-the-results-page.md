---
status: open
spec: BackOffice 4354
blocked-by: 971, BO 4397
---

# 974 — The old advisor pages go, and the menu opens the results page

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Remove today's two advisor pages, their models, queries, columns, the placeholder banner and their locale keys.
- The menu entry "Sourcing advisor" opens the results page. The old order route opens that order's stored run in the simulator, or says it has none and offers a replay.
- Ships together with the BackOffice ticket that removes the old doors.

## Spine reach

oms-react: routes / pages removed / locales / tests

## Proof (→ `tdd` red-green cycles)

- [ ] `old-order-link-model.test.ts` — a stored run opens the simulator; none offers a replay · vitest (`npm test`)
- [ ] `tools/sourcing-results-drive.mjs` — the menu entry opens the results page; the old order link answers · Playwright drive, run by hand against stubs

## Boundaries

Removal; ships with the BackOffice release that retires the scorer.

## Done when

The old pages are gone, the model test is green and the drive passes.

## Blocked by

[971](971-the-comparison-results-page-one-sentence-one-bar-three-panels-where-the-plans-differ-and-a-figur.md),
BackOffice 4397 (`.issues/4397-the-nightly-scorer-is-retired-and-the-copilot-answers-from-the-comparison.md`)
