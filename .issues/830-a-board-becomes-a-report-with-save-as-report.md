---
status: done
spec: 819
blocked-by: 828
---

# 830 — A board becomes a report with "Save as report"

## What to build

On a board an author may edit or copy, "Save as report" creates a Personal report (801 item 6):
- the board's view panels are copied **inline** into one section, in reading order, each recording `from { viewId, revision }`;
- its text panels become text blocks, and its section panels become headings;
- its parameters and bindings are copied.

The report opens in the designer. There is no conversion back.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

store/logic (pure board → report mapping) · component (the action) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `boardToReport` — reading order taken from the grid (in logical order); each kind of panel mapped; params and bindings carried; provenance recorded · pure
- [ ] drive: Save as report on a board opens the designer holding its panels in order · flow

## Boundaries

Item create with `kind: report`. A new `boards` key for the action.

## Done when

The pure test is green and the drive turns a board into a report.

## Blocked by

[828](828-an-author-builds-a-reports-structure-in-the-designer.md)

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
