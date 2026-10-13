---
status: open
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

- [ ] `chartModel`: hour vs day labels; the max scales both series; an all-zero series draws without a divide-by-zero (vitest)
- [ ] The drive is extended. It checks 24 hourly buckets on Today and 31 daily buckets on a 31-day
  range, takes a screenshot in LTR and in RTL, and checks the readout on hover.
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

No new door, no new dependency.

## Done when

The chart renders hourly and daily from the stub in both directions, and `chartModel` is green.

## Blocked by

[484](484-an-hq-user-sees-today-s-delivery-statistics-across-all-stores.md)
