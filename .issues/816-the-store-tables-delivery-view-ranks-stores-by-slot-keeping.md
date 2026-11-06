---
status: open
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

- [ ] `the Delivery view carries the five new figures as sent` — from the store's Delivery track; absent → null, never 0; a store without the fields reads null in each · pure
- [ ] `a chosen courier opens on Delivery sorted by Out of slot % worst first` — the default view and sort column per courier/all; column maxima for the bars · pure
- [ ] drive — choosing FarEye shows the Delivery view ranked by Out of slot % descending with "—" last; the three bar columns draw bars; all couriers keeps today's default; LTR and RTL · flow (Playwright)

## Boundaries

- No door change beyond 812's model.
- The grid gate: the grid still spreads `OMS_GRID_BASE_COL_DEF`; `CellBar` isolates its own whole value, no `fsi` in a cell.
- i18n: five headers.

## Done when

The pure tests are green and the drive shows the new columns, bars and courier default sort in LTR and RTL against the stub.

## Blocked by

- [812](812-the-headline-strip-shows-the-six-server-figures-and-their-change.md)
- [813](813-choosing-a-courier-narrows-the-page-to-its-home-deliveries.md)
