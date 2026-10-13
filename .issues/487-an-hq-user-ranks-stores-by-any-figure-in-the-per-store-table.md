---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2641-oms-react-delivery-statistics-brief.md
blocked-by: 484
---

# 487 — An HQ user ranks stores by any figure in the per-store table

## What to build

- **The grid:** a per-store AG Grid from `Stores[]`, so branches can be compared.
  - It spreads `OMS_GRID_BASE_COL_DEF`, which the lint gate checks.
  - One column per flow figure (with **Trips** beside Out for delivery), one per miss, and Avg
    hand-over.
  - Every column sorts, numerically. The default sort is Handed over, descending.
- **Missing values:** a figure the server leaves out, or a null average, shows "—" and sorts
  last, never as 0.
- **Settled (overrulable):** when one store is chosen (485), the table stays, showing that
  store's single row.
- **Read-only:** no drill from a figure into its deliveries (out of scope, as on the till).

## Spine reach

logic (row mapping) · component (grid) · i18n EN/AR (header names) · test

## Proof (→ `tdd` red-green cycles)

- [x] `storeRows`: maps `Stores[]` to rows; an absent figure becomes `null`; the comparator sorts `null` last in both directions (vitest) — `store-rows.test.ts`, 14 tests (`compareFigures` checked through an AG-Grid-style sort that negates the answer when descending)
- [x] The drive is extended. It checks the row count matches the stub, that sorting by Trips
  reorders the rows, and that an absent `trips` renders "—" (LTR and RTL). — `tools/delivery-statistics-drive.mjs` §12
  plus the older-server fixture, **134/134** on a stubbed door: columns and order, locale headers with no isolates,
  one row per stubbed store, default Handed over ↓, Trips ↑/↓ reorders numerically, a null average reads
  "—" and sorts last both ways, absent `trips` reads "—", one store chosen keeps one row, store column
  pinned to the reading start, no page errors — in LTR and RTL.
- [x] `npm run typecheck`, `npm run lint`, `npm test` green (274 files / 4854 tests), `npm run build` green

**Outstanding (not AFK):** the live door (ticket 488) and an owner's eye on the Arabic table.
Decisions taken AFK (store column pinned to the reading start, no header tooltips, duplicate
storeCode not guarded, the Trips / Avg hand-over (min) captions) are in `.afk/HITL-487.md`.

## Boundaries

No new door. Header names come from `t()`, not `fsi`: grid sinks never take isolates.

## Done when

The table renders and sorts from the stub, and `storeRows` is green.

## Blocked by

[484](484-an-hq-user-sees-today-s-delivery-statistics-across-all-stores.md)
