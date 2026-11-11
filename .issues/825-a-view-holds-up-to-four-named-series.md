---
status: done
spec: 819
blocked-by: 820, 821
---

# 825 — A view holds up to 4 named series, each in its own colour, with no total, highlight on legend click and a series export column

## What to build

The chart editor gains **named series** (799): up to 4, each with a label in English and Arabic and filters on the view's own category dimensions. HungerStation is `channel = hungerstation` and QC is `delivery_type = QC`.

- **The query answer** carries a `series` column role. Rows are merged per series on the shared axis.
- **The chart:**
  - the series take the colour role in slot order, with the 820 fix applied;
  - there is no total across series;
  - clicking a legend entry or a colour highlights that series and never cross-filters;
  - a KPI tile shows one figure per series side by side;
  - line, area, bar, combo, table and KPI take series; donut and heatmap do not.
- **The export** carries a `series` column.
- **Binding:** a members parameter cannot bind to a dimension a series filters on in that panel, and the reason is `seriesFilters`.
- **Refusals** at save are `ANALYTICS-411`: more than 4 series, a duplicate label, or a foreign dimension.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

model (view `series[]`) · store/logic (series merge, export rows) · component (editor + `core/charts`) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `mergeSeries` — per-series rows on a shared axis, in slot order, with no cross-series total · pure
- [ ] `series export` — the CSV and xlsx rows carry a `series` column, with isolates stripped · pure
- [ ] drive: build HungerStation against QC on a bar and on a KPI; the colours are distinct; a legend click highlights without cross-filtering; a fifth series is refused · flow

## Boundaries

The proposed view shape `series[]`. The Query output's `series` role. Code 411 for series. New `boards` keys.

## Done when

The pure tests are green, and the drive shows the acceptance case's two series in one chart.

## Blocked by

[820](820-multi-series-bars-draw-each-series-in-its-own-colour.md), [821](821-a-v1-board-runs-through-the-six-ready-made-parameters-unchanged.md)

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
