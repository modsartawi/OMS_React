---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2660-oms-react-statistics-by-track-brief.md
blocked-by: 489
---

# 491 — The per-store table switches between Delivery, Pick-up and All

## What to build

An ops manager ranks stores on one track without a table too wide to read: one **Delivery / Pick-up /
All** switch above the per-store table (487). **All** is the default.

| View | Columns (after Store) | From |
|---|---|---|
| **All** | today's columns, then **Unspecified** as the last flow column (decision B, owner-agreed 2026-10-14) | `flow`, `misses`, `avgHandOverMinutes`, `unspecified` |
| **Delivery** | Came in, Made ready, Out for delivery, Trips, Delivered, Returned back, Rejected, Rescheduled, Close requested, Closed / cancelled, Avg time to deliver | `tracks.delivery` |
| **Pick-up** | Came in, Made ready, Picked up, Close requested, Closed / cancelled, Avg time to ready | `tracks.pickUp` |

- Ranking works on every column of every view (`compareFigures`, "—" last both ways); the default
  ranking is the view's hand-over column, descending.
- A store row without `tracks` (an SIS.Api older than 2660) reads "—" in every cell of Delivery and
  Pick-up, never 0. Unspecified absent → "—".
- Pick-up leaves Returned back, Rejected and Rescheduled out of its columns (a table cannot hide per
  row; 490's row shows them when non-zero).
- The switch is held in the URL with the other controls: `track=delivery` / `track=pickUp`; absent =
  All, unknown = All.
- The rows are what the door sent per store, never summed into the lanes.

## Spine reach

store/logic (`store-rows.ts`, `query.ts`) · component (`StoreTable`) · i18n (en + ar) · test

## Proof (→ `tdd` red-green cycles)

- [x] `each view's columns are its track's figures in order` — All (with Unspecified), Delivery, Pick-up as the table above · pure (vitest, `store-rows.test.ts`)
- [x] `a store row without tracks reads null in every Delivery and Pick-up figure` — and a full row maps each `tracks` figure to its column · pure (vitest)
- [x] `the track switch round-trips through the URL` — absent/unknown → All, `delivery`, `pickUp` · pure (vitest, `query.test.ts`)
- [x] Drive: switch to each view, check headers, a ranked column, "—" on a stub row without `tracks`, and the URL param · flow (drive) + typecheck

**Proof, as run (2026-10-14):** `store-rows.test.ts` + `query.test.ts` green (91 in the feature, 5142 in the suite);
typecheck, lint (4 gates) and build clean. `tools/delivery-statistics-drive.mjs` §16 runs in LTR and RTL on the stub
(two stores with `tracks` and a store row with no `tracks` and no `unspecified`): 284/284. It switches All, then Delivery,
then Pick-up, then back to All. It checks the headers, each view's default ranking, ascending and descending sorts with
"—" last, a dash in every Delivery and Pick-up cell of the store row without `tracks`, `track=delivery` and
`track=pickUp` in the URL, no door call on a switch, a link that opens on Pick-up, and an unknown track reading as All.
Outstanding, not AFK: the Arabic header and switch rendering by eye (the drive's RTL pass keeps `lng: 'en'`), and the
live door (492). The rulings taken are in `.afk/HITL-491.md`.

## Boundaries

- Same door, live: BackOffice 2660 (done; deploy unconfirmed → stubbed).
- The grid keeps spreading `OMS_GRID_BASE_COL_DEF` (lint gate); no `fsi` in any formatter.
- Keys in `delivery-statistics` en + ar.

## Done when

The three vitest cases are green, typecheck + lint pass, and the drive switches all three views on the
stub with the URL holding the choice.

## Blocked by

[489](489-the-statistics-page-draws-a-delivery-lane-and-a-pick-up-lane.md)
