---
status: done
spec: 766
blocked-by: 767
---

# 768 — A view draws as a KPI, line, stacked area or any bar variant, with compare-previous and the top 5 plus Other

## What to build

- **The time and category forms of `core/charts`:**
  - a KPI tile with a sparkline, and ▲▼ % against the previous period from `previous` rows;
  - line: 1–4 measures × time, or 1 measure × time × 1 category;
  - stacked area;
  - bar: vertical, horizontal, stacked and grouped.
- **The top 5 plus "Other":** a breakdown with more than five members folds the rest into "Other",
  in ink grey (766 §E amendment 2).
- **Number formats by unit:** auto, integer, decimal, %, SAR and minutes.
- **A tooltip on every mark,** a legend for two or more series, and Recharts' `accessibilityLayer`.
- **A rate measure is never stacked.** The view model refuses it, as a guard behind the editor.

## Spine reach

store/logic (view model: deltas, Other, formats) · component (`core/charts` forms) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `view model: compare-previous gives the delta and direction, and a zero previous gives no %` · pure (vitest)
- [x] `view model: six members fold to five plus Other, and a rate measure is never stacked` · pure (vitest)
- [x] `each form draws in en/ar/dark with its tooltip` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

All forms render on the view page in the drive, and the pure tests are green.

## Blocked by

[767](767-an-analytics-view-opens-at-analytics-view-id-and-draws-its-bar-chart-behind-the-analytics-probe.md)

## Comments

**2026-11-05 — built (impl/766-768).** Pure: `features/analytics/boards/series-view.ts` (+ test), `core/charts/format.ts`
`formatAs` (+ test). Forms: `core/charts/KpiTile.tsx`, `core/charts/SeriesChart.tsx` (line, stacked area, bars
vertical/horizontal/stacked/grouped), drawn via `boards/SeriesPanel.tsx`. Drive: `DRIVE_ONLY=768` 61 checks × en/ar/dark, all pass.

Rulings made (⚠, overrulable; the server stays the authority):
- Definition fields `chart.stack` (`stacked`|`grouped`, default grouped) and `chart.format` (absent = auto) — §C fixes neither.
- A KPI over days sums an additive measure for its headline; a rate or percentile over several rows has NO headline
  (never summed or averaged, 766 §B), only its sparkline. One row is the server's own figure.
- Top 5 = the five largest members by total; colours still by entity. A rate breakdown past five DROPS the rest
  (an "Other" rate cannot be computed from the rows) — `folded` counts them, nothing on screen says so yet.
- The KPI change is drawn in ink with an arrow, not in a status colour (up is not always good).
