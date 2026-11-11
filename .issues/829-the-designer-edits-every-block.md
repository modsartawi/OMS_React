---
status: done
spec: 819
blocked-by: 824, 825, 828
---

# 829 — The designer edits every block: parameters, panels with series and copy-from-view provenance, text with live figures, the summary

## What to build

The inspector gains every editor:
- **The parameter inspector** is 824's, reused in the report, with "+ Parameter" in the strip.
- **The panel editor:**
  - provenance: "copied from … r n", and "the original changed since you copied it";
  - area, measures, axis and chart type, with only the fitting types offered;
  - named series, up to 4 (825);
  - the panel's own parameter list.
- **"Copy a saved view"** in "Add to this section" picks a view, copies it inline and records `from { viewId, revision }`.
- **The text editor:** English and Arabic fields, "Insert a live figure" (pick a panel and one of its single values), and a preview. Figures show as chips, never as raw tokens.
- **The summary block:** add it, at most one, and remove it.

Every edit is one history step. A live figure naming a missing panel or a non-single value is in the 411 list.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

store/logic (figuresOf, token insert, provenance) · component (inspector editors) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `figuresOf + token round-trip` — a panel's single values; inserting a chip writes a token; the text ↔ chip round-trip; a missing or non-single figure refused by `validate` · pure
- [ ] drive: build the sample report's panels (one copied from a view, one with HungerStation and QC series), a text with a live figure, and the summary; edit, undo, save · flow

## Boundaries

Reads `Analytics/Items` to pick a view to copy. Computes `sourceChangedSinceCopy` from the item. New `boards` keys.

## Done when

The pure test is green and the drive builds the 798 sample report by hand.

## Blocked by

[824](824-an-author-declares-a-parameter-on-a-board-with-pre-filled-bindings.md), [825](825-a-view-holds-up-to-four-named-series.md), [828](828-an-author-builds-a-reports-structure-in-the-designer.md)

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
