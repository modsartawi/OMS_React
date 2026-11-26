---
status: open
spec: BackOffice 4354
blocked-by: 971, BO 4394, BO 4396
---

# 973 — The Trials tab and the Phase 2 bar tab

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Trials: the list of trials, the form that starts one (a saved version and a period; needs the save grant), a trial's result (orders solved, refused by reason, failed), the factor table, and "open with this set beside it", which puts the tried set in the page's "Set beside it": a banner, a thin second bar, one more column in the breakdowns, the promise check under that set.
- Phase 2 bar: its own picker for 28 days and a channel group; each limit in words with its figure and "met", "not met" or "cannot be read yet" with why; the things read that are no limit, apart; the 30 largest differences to open and mark; the rulings to write; and "accept this reading", which keeps it.
- No riyal sum, no green and no red.

## Spine reach

oms-react: page / models / locales / tests

## Proof (→ `tdd` red-green cycles)

- [ ] `trials-model.test.ts` — the list, a result with its refusals, and the factor table · vitest (`npm test`)
- [ ] `bar-model.test.ts` — each limit with its state and why; "cannot be read yet" names the cause · vitest (`npm test`)
- [ ] `tools/sourcing-results-drive.mjs` — start a trial on stubs, open its result beside the candidate set, read the bar · Playwright drive, run by hand against stubs

## Boundaries

—

## Done when

The model tests are green and the drive passes.

## Blocked by

[971](971-the-comparison-results-page-one-sentence-one-bar-three-panels-where-the-plans-differ-and-a-figur.md),
BackOffice 4394 (`.issues/4394-a-saved-version-is-tried-over-stored-runs-and-two-sets-are-read-side-by-side.md`),
BackOffice 4396 (`.issues/4396-the-phase-2-bar-is-read-limit-by-limit-and-a-shelf-chance-figure-is-marked-enough-too-few-or-not.md`)
