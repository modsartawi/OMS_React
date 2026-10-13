---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2641-oms-react-delivery-statistics-brief.md
blocked-by: 484
---

# 486 — The page draws Came in and Handed over by hour for a day, by day for a range

## What to build

- **The chart:** a column chart of `Series`, drawing **Came in** and **Handed over** side by side
  for each bucket. It matches the till's two column charts.
  - Today and Yesterday are drawn **by hour**; a Range is drawn **by day**. The server sends every
    bucket, zeros included.
- **Settled (overrulable):**
  - Hand-rolled **inline SVG** on the theme tokens. No chart library is added: the app has none,
    and this is the only chart.
  - Colours come from tokens only; `npm run lint` (palette and contrast) must stay green.
  - A simple legend, and a hover/focus readout of the bucket's two values.
- **Reading direction and isolation:**
  - Time runs in reading order, so it mirrors under RTL.
  - Bucket labels (hours, dates) and values are machine values: isolate them with `Ltr`, and use
    `fsi()` in any string-only sink such as a `title` or an `aria-label`.

## Spine reach

logic (series → bars/labels model) · component (SVG chart) · i18n EN/AR · test

## Proof (→ `tdd` red-green cycles)

- [x] `chartModel`: hour vs day labels; the max scales both series; an all-zero series draws without a divide-by-zero (vitest) — `chart-model.test.ts`, 9 tests, red first (module missing) then green: `niceTop` (the till's steps), every third hour `HH` / readout `HH:00`, day of the month thinned 1/2/5 as on the till across a month end / readout `yyyy-MM-dd`, one shared top over BOTH series, all-zero → top 6 and every share 0, an absent value → the dash and no column, an unreadable bucket kept unlabelled, server order kept
- [x] The drive is extended. It checks 24 hourly buckets on Today and 31 daily buckets on a 31-day
  range, takes a screenshot in LTR and in RTL, and checks the readout on hover. — `tools/delivery-statistics-drive.mjs` §13,
  **170/170** on a stubbed door (LTR and RTL): the chart between the misses band and the store table; 24 hourly
  columns, `00 03 … 21` labels isolated; axis `30 20 10 0`; time in reading order (left→right in LTR, right→left in
  RTL) with each label under its column; Came in first in reading order within a bucket; a zero bucket draws no
  column; hover 09:00 reads `09:00 · Came in 12 · Handed over 7`, each value in its own `<bdi dir="ltr">`; a real 0
  reads 0; leaving clears; focus + the reading-direction arrow / End step the buckets; a 31-day custom range draws 31
  daily columns labelled every fifth day; hovering the last day reads its date. Screenshots `{ltr,rtl}-chart-today.png`,
  `{ltr,rtl}-chart-range31.png` (not committed).
- [x] `npm run typecheck`, `npm run lint`, `npm test` green (275 files / 4864 tests), `npm run build` green

**Outstanding (not AFK):** the live door (ticket 488) and an owner's eye on the Arabic chart (the drive runs RTL
with the English bundle, so its readout shows English words in an RTL line, as 484's tiles do). Decisions taken AFK
(one shared axis, primary/success colours, no "now"/future marking, the label and readout formats) are in
`.afk/HITL-486.md`.

## Boundaries

No new door, no new dependency.

## Done when

The chart renders hourly and daily from the stub in both directions, and `chartModel` is green.

## Blocked by

[484](484-an-hq-user-sees-today-s-delivery-statistics-across-all-stores.md)
