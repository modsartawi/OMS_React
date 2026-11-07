---
status: done
spec: 811
blocked-by: —
---

# 815 — The Came in vs Handed over chart is drawn by core/charts and dims while Today refreshes

## What to build

The hand-drawn SVG chart (486) is replaced by the shared **`core/charts` `SeriesChart`**:

- bar form, **grouped**, with two series (Came in, Handed over) on **one** axis, as ruled in 486;
- one column group per bucket, in the server's order, with nothing filled in or summed; a value the
  server leaves out draws no bar;
- labelled by the hour (Today, Yesterday) or by the day (Range) as today, the bucket read as text and
  never through `Date`;
- a tooltip on every bar, a legend, the a11y layer, and RTL mirroring, all from `core/charts`.

It sits in a **`ChartFrame`**. The statistics query keeps its previous answer while it refetches, so
the 5-minute Today refresh dims the chart with the "Updating" mark instead of blanking it. A refused
period and an error still behave as today.

The hand-drawn `SeriesChart` and its `chart-model` (and that test) are **deleted**. A small pure series
mapper turns `series` into `core/charts` rows and replaces them.

## Spine reach

logic (series mapper) · component (SeriesChart in ChartFrame, query keeps previous data) · i18n (chart
aria label / series names) · test

## Proof (→ `tdd` red-green cycles)

- [x] `series maps to chart rows in the server's order, nothing filled in` — hour and day labels as today's chart-model gave them; an absent value stays null · pure
- [x] drive — the chart renders grouped bars with a tooltip on hover; after the 5-minute Today refresh is triggered the frame reads busy and the chart stays on screen; Yesterday does not poll; LTR and RTL; no page errors · flow (Playwright)

## Boundaries

- No door change.
- Removes a feature-local chart; `core/charts` stays the only Recharts importer.
- Analytics' light `--chart-2` contrast (2.83:1) is inherited by the second series; noted in spec 766, not fixed here.

## Done when

The mapper test is green, the old chart and its model are gone, `typecheck` + `lint` are green, and the drive shows the chart and the dimmed refresh in LTR and RTL.

## Blocked by

None — can start immediately.

## Comments

- 2026-11-06 (impl/815-core-chart): built red-green. `series-rows.ts` (+ test) maps `series` to `core/charts` rows in the server's order, an absent value `null`; `StatisticsChart.tsx` draws core `SeriesChart` (bar, grouped, two series, one axis) in a `ChartFrame` whose `busy` is the query's `isFetching`. Old `SeriesChart.tsx` + `chart-model.ts` + its test deleted; the readout/hint keys went with them, `chart.label` is now per granularity.
- Labels: `HH:00` by the hour, the whole `yyyy-MM-dd` by the day (one label serves the tick and the tooltip heading; Recharts' `minTickGap` thins crowded ticks), so the old every-third-hour / day-of-month thinning is gone. A 0 still draws no bar (Recharts draws no zero-height rectangle).
- Keeping the previous answer: a same-key refetch (the 5-minute refresh) keeps its data by TanStack default. Across keys, `placeholderData` keeps it only for Today's midnight roll-over (`keepsPreviousAnswer` in `query.ts`, tested): a new tab, store or leave-out never shows the previous figures as current. The tab joined the query key for that (`statisticsKey`).
- Drive: section 13 rewritten for core/charts (grouped bars, legend, tooltip, LTR + RTL reading order) plus the dimmed refresh (stub holds the refetch's answer 3 s: frame busy, aria-busy, Updating mark, bars stay; Yesterday never busy).
