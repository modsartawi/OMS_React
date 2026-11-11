---
status: done
spec: 819
blocked-by: —
---

# 820 — Multi-series bars draw each series in its own colour

## What to build

Today a bar chart with two or more measure series draws every bar in `--chart-1`, because each data row carries its own `fill`, and Recharts gives a row's fill priority over a `<Bar fill>` prop (found in [798](798-how-does-an-author-declare-a-parameter-and-a-viewer-run-the-report-with-it.md)). After this slice, each series takes its own colour slot in order, and its legend matches.

A single-series bar keeps colouring by member (fixed slots for channels and countries, otherwise the saved member → slot map) or by slot 0, exactly as now. The fix is a pure rule: the row `fill` is set only when there is one series. The rest of spec 819 is not needed for this; it is the spec's first web ticket because it is a defect on main.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

store/logic (a pure row-fill rule in `core/charts`) · component (SeriesChart) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `seriesRowFill` — one series → each row carries its member or slot-0 colour; two or more series → no row fill, so each series colour applies · pure
- [ ] drive: a two-measure bar board shows two distinct bar colours that match the legend, in en, ar and dark · flow (Playwright, `tools/analytics-drive.mjs`)

## Boundaries

No new door, key or namespace. Touches `core/charts` only, so every screen drawing a multi-series bar (analytics and Delivery statistics) is fixed at once. Check the Delivery statistics situation view (spec 811) still renders its single-series bars per member.

## Done when

The pure rule test is green, and the drive shows a multi-series bar drawn in distinct colours on main.

## Blocked by

None — can start immediately

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
