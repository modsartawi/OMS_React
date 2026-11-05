---
status: done
spec: 766
blocked-by: 767
---

# 770 — The analytics home lists Certified boards first, then Shared, then my own, with search

## What to build

`/analytics` reads `GET Analytics/Items`:
- three groups, in the order Certified, Shared, then Mine;
- each item shows its tier badge, owner and last change;
- a search by title matches either language;
- an empty state explains how to start.

Opening an item routes to `/analytics/board/:id` or `/analytics/view/:id`. Board pages arrive in
771; until then a board opens its not-found state.

## Spine reach

model/api (`Items`) · store/logic (grouping and search) · component/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `home grouping: Certified, Shared, Mine, newest first within each, search matches en or ar title` · pure (vitest)
- [x] `home lists the stubbed items in order and search narrows them` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive shows the grouped home and search working.

## Blocked by

[767](767-an-analytics-view-opens-at-analytics-view-id-and-draws-its-bar-chart-behind-the-analytics-probe.md)

## Resolution

- Pure: `src/features/analytics/boards/home.test.ts` (6 cases) + `readItems` in `wire.test.ts`.
- Flow: `tools/analytics-drive.mjs` 770 scenarios (ltr, rtl, empty) — 89/89 with 767's.
- Rulings: "Mine" is the Personal tier (a Personal item is seen by its owner only, CONTEXT.md *Tier*), so
  no user id is read; search is client-side over the one `Analytics/Items` list (no `kind`/`tier`/search
  params sent); an untitled view is shown and found by its generated title; `Items`' `data` is read as a
  bare array or `{ items }` (⚠ §C does not fix it). `/analytics/board/:id` is a not-found placeholder
  (`AnalyticsBoardPage.tsx`) that 771 replaces.
