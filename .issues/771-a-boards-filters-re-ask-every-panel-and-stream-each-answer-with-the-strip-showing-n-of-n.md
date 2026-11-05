---
status: done
spec: 766
blocked-by: 768
---

# 771 — A board's filters re-ask every panel and stream each answer, with the strip showing n of N

## What to build

The board page at `/analytics/board/:id`:

- **The layout:** panels laid out from the board's definition on a 12-column grid in logical order.
  The panels are views linked by reference, plus text and section-header panels. Read only; editing
  is 777.
- **The filter strip:**
  - a relative or fixed period, with presets for today, yesterday, this week, last week, the last
    7, 28 or 30 days, this month, last month and year to date;
  - city, region and store (`GET Analytics/DimensionValues`);
  - channel and country.
- **Opt-outs:** each panel honours its opt-outs.
- **The effective-query module** is pure: definition ⊕ board filters (unless opted out) → a
  canonical key. The period is sent as a relative token.
- **Streaming feedback:** only the panels whose key changed re-run, each one redraws on its own
  answer, and a superseded answer is dropped. The strip shows "Updating… n of N panels" with a
  determinate bar and a polite live region.
- **The filters live in the query string,** which is the permalink.

## Spine reach

model/api (`DimensionValues`, board definition) · store/logic (effective query, permalink codec) · component/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `effective query: same inputs give the same key; a filter change re-keys only the panels it reaches; an opted-out panel keeps its key` · pure (vitest)
- [x] `permalink: board filters survive encode → decode, relative periods stay relative` · pure (vitest)
- [x] `a region change shows the strip and every card busy within 0.5 s, then the panels resolve one by one` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive proves the streaming board with stubbed delays, and the pure tests are green.

## Blocked by

[768](768-a-view-draws-as-a-kpi-line-stacked-area-or-any-bar-variant-with-compare-previous-and-the-top-5-plus-other.md)
