---
status: done
spec: 811
blocked-by: 812, 813
---

# 816 — The store table's Delivery view ranks stores by slot keeping, trips and delivery time

## What to build

The per-store table's **Delivery** view gains five columns, read from each store row's Delivery track
as sent: **In slot %**, **Out of slot %**, **No slot**, **Delivered per trip** and **Avg delivery time**.
Shares are the server's (0–1), shown as percentages; an absent one is "—" and sorts last either way.

- **Out of slot %**, **Delivered per trip** and **Avg delivery time** render through `core/charts`
  `CellBar`. The bar's length is in proportion to the column's largest value, in ink and never in a
  status colour. Its job is to make outliers stand out; it says nothing about good or bad. The cell
  keeps its formatted value and isolates it; nothing extra reaches Ctrl+C or an export.
- With a **courier chosen** (813), the table opens on the Delivery view **sorted by Out of slot %,
  worst first**, with "—" last. With all couriers, the default view and sort are today's (All by
  Handed over; a view by its hand-over column).
- Delivery view's existing Avg column becomes Avg delivery time; the All view's average is the
  store-wide Avg delivery time. The All and Pick-up views are otherwise unchanged.

## Spine reach

logic (store-rows: the new figures, column maxima, the courier default) · component (StoreTable
columns + CellBar) · i18n (headers) · test

## Proof (→ `tdd` red-green cycles)

- [x] `the Delivery view carries the five new figures as sent` — from the store's Delivery track; absent → null, never 0; a store without the fields reads null in each · pure
- [x] `a chosen courier opens on Delivery sorted by Out of slot % worst first` — the default view and sort column per courier/all; column maxima for the bars · pure
- [x] drive — choosing FarEye shows the Delivery view ranked by Out of slot % descending with "—" last; the three bar columns draw bars; all couriers keeps today's default; LTR and RTL · flow (Playwright)

## Boundaries

- No door change beyond 812's model.
- The grid gate: the grid still spreads `OMS_GRID_BASE_COL_DEF`; `CellBar` isolates its own whole value, no `fsi` in a cell.
- i18n: five headers.

## Done when

The pure tests are green and the drive shows the new columns, bars and courier default sort in LTR and RTL against the stub.

## Blocked by

- [812](812-the-headline-strip-shows-the-six-server-figures-and-their-change.md)
- [813](813-choosing-a-courier-narrows-the-page-to-its-home-deliveries.md)

## Comments

2026-11-06 — built on `impl/816-store-table-slot`.

- **Logic** (`store-rows.ts`): the Delivery view reads `inSlotShare`, `outOfSlotShare`, `noSlot`, `deliveredPerTrip` and
  `avgDeliveryMinutes` from each store's `tracks.delivery` as sent (absent → null). Columns: after Delivered, In slot %, Out of
  slot %, No slot, Delivered per trip; the misses; Avg delivery time last (replacing the lane's entry-based average). All's
  average is the store's `avgDeliveryMinutes`; Pick-up keeps `avgHandOverMinutes` (Avg time to ready). New `defaultTableTrack`,
  `defaultSort`, `CELL_BAR_FIGURES`, `columnMaxima`. Pinned by `store-rows.test.ts` (7 new, 5 updated for the retired column).
  Shares read through `figures.ts` `readShare` (en-US percent, up to one place: no locale marks reach Ctrl+C); 816 and 814 each added one, and the merge keeps 814's format (`15%`, not `15.0%`).
- **Opening on Delivery** needed the URL too (`query.ts`): the scope's default view is absent from the URL (All with all
  couriers, Delivery under a courier; `track=all` is written under a courier). `withCourier` re-opens the table on the new
  scope's default view whenever the courier changes (so all couriers → FarEye goes to Delivery, FarEye → all couriers back to All);
  the same scope keeps the view. ⚠ This changes two 813 expectations in `query.test.ts` (All under a newly chosen courier stayed
  All; un-choosing kept Delivery) — the ticket's "opens on Delivery" / "all couriers = today's default" overrides them.
- **Component** (`StoreTable.tsx`): new `courier` prop; the three bar columns render `core/charts` `CellBar` (unchanged; its own
  `Ltr` isolate, `valueFormatted` kept) with `max` from `columnMaxima`; `initialSort` from `defaultSort`; grid keyed by view +
  opening sort. Grid still spreads `OMS_GRID_BASE_COL_DEF`; no `fsi` in a cell.
- **i18n**: `table.inSlotShare/outOfSlotShare/noSlot/deliveredPerTrip/avgDeliveryTime`, en + ar; the now-unused
  `table.avgHandOver` / `table.avgToDeliver` removed. Arabic share headers are worded ("نسبة …") rather than led by a neutral `%`.
- **Ink**: `CellBar` draws in `--chart-1` at 28% (the chart ink, no status token) — taken as the spec's "ink"; not changed here.
- **Drive**: new section 19 `driveSlotTable` (four stores, one sending none of the new figures): all couriers = All by Handed
  over; FarEye → Delivery (no `track` in the URL), Out of slot % desc with "—" last (and still last ascending); bar lengths per
  column maximum, drawn widths, growth from the reading start, cell text = formatted value with no isolate characters; All under a
  courier by Handed over; back to all couriers. Sections 12/16/18 updated for the new columns and the URL default. LTR + RTL.

