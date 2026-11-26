---
status: open
spec: BackOffice 4354
blocked-by: 971, BO 4393, BO 4391
---

# 972 — The results page's five reading tabs

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Breakdowns: rows by mode, city, channel or day, with the rows "a line the stock figure could not cover" and "the channel's own split", who made the run and why no checkout run was used, and the runs with pairs cut by the cap.
- Outside the advisor's rules: by the refused pin's reason, a share bar and one sentence each, and a line saying these orders are a group of their own.
- Promise and stock checks: Dawaa Now by distance band; the shelf chance table (36 cells, a mode switch, a second switch "Picks" or "Counts by half-year"); the eight short-figure rows marked "from deliveries" with their one-line and every-delivery ratios and the lines per channel group; the fixed note on the two ratios; each mode's fleet ratio; the window and the number of counts.
- Later slots: one sentence and a bar per hour, labelled "evidence for phase 2".
- Orders not run: by reason.

## Spine reach

oms-react: page / models / locales / tests

## Proof (→ `tdd` red-green cycles)

- [ ] `breakdowns-model.test.ts` — the rows and columns for each of the four groupings · vitest (`npm test`)
- [ ] `shelf-chance-evidence-model.test.ts` — cells with their evidence; rows with both ratios; "too few" where so · vitest (`npm test`)
- [ ] `later-slots-model.test.ts` — the count by hour · vitest (`npm test`)
- [ ] `tools/sourcing-results-drive.mjs` — open each tab, in both languages · Playwright drive, run by hand against stubs

## Boundaries

—

## Done when

The model tests are green and the drive passes.

## Blocked by

[971](971-the-comparison-results-page-one-sentence-one-bar-three-panels-where-the-plans-differ-and-a-figur.md),
BackOffice 4393 (`.issues/4393-the-results-doors-answer-the-bar-the-panels-the-breakdowns-and-the-orders-behind-a-figure.md`),
BackOffice 4391 (`.issues/4391-the-evidence-pass-counts-lines-per-cell-and-row-and-gives-each-store-its-short-figure-factor-and.md`)
