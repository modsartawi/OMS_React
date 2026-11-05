---
status: done
spec: 766
blocked-by: 772
---

# 774 — Drilling to detail from a store or city opens the Deliveries list already filtered

## What to build

A detail drill hands off to an existing OMS screen, under that screen's own grants and masking. It
never shows raw rows inside analytics (755 item 2).

- **The prefactor:** the Deliveries list today takes **no filters from its URL**. Give it a URL
  filter entry for store, city and a date range, read once on entry. This is the prefactor in
  `features/oms/deliveries`, and nothing else about that screen changes.
- **The drill:** a store or city point offers "See deliveries", which routes to the Deliveries list
  with those filters and the board's period. Till-sales measures offer no detail drill.

## Spine reach

component/route (Deliveries URL entry; the drill menu) · store/logic (period → Deliveries filter) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `period → Deliveries filter: a relative period resolves to the same from–to the Deliveries list expects` · pure (vitest)
- [x] `drill from a store opens Deliveries filtered to that store and period; till value offers no detail drill` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Touches `features/oms/deliveries` (its URL entry only). The analytics feature links by route string and never imports it.

## Done when

The drive lands on a filtered Deliveries list from a board.

## Blocked by

[772](772-clicking-a-mark-cross-filters-the-other-panels-and-drill-by-keeps-a-breadcrumb.md)

## Open questions

Which Deliveries filters can a URL carry today without changing its saved-view bundles? Settle that first in the ticket.

### Answer (settled before building)

A saved view's bundle (`saved-views.ts`, store key `oms.deliveries.views.v1:<user>`) holds the query bar's
`QueryCriteria` (13 entries, the Date kept relative or Custom `yyyy-MM-dd`), the lens, the column state and the
grid's column filters. A URL filter is safe when it lands on an entry the bundle already holds, so the search it
opens is an ordinary `QueryCriteria` that "Save current view" captures with no new field and no store version bump.

- **Store → safe.** `store=<code>` is the bar's Store code (`StoreCode` on `SdDocumentWeb/DeliveryDocumentList`).
- **Date range → safe.** `from=<yyyy-MM-dd>&to=<yyyy-MM-dd>` is the bar's Custom Date. Both ends must be real days
  with from ≤ to, or no date is set (as the bar does with a half Custom range).
- **City → not safe, so the city drill is left out (766 §F: "or that drill is left out").** The list has no city
  criterion: neither the bar, the bundle nor the server door takes one. Adding one changes the bundle's shape and
  needs a BackOffice param. Rejected alternative: a grid column filter on `cityName` fits the bundle (it holds
  the filter model) but narrows only the loaded page (Limit 200, often cut), so it would undercount without saying so,
  and a city member key (`riyadh`) is not the grid's display name. A city drill needs a server `City` criterion first.

The URL entry is read **once** on entry: it replaces the in-memory search and the starred default, sets the lens
to All and no active view, runs the search as soon as the grant is in, and is then cleared from the URL (replace),
so Back from Delivery details comes back to the search it ran.

## Rulings made while building (⚠, confirm with the model owner)

- **Which measures offer "See deliveries":** a store point on a panel whose measures are ALL in the `sales` or
  `delivery` areas and none is a till measure (key `till_*`). The model has no "has a detail screen" flag; a
  `detailRoute` per measure on `Analytics/Model` would replace this guess. A panel showing a till value next to
  orders offers none (story 29: never a dead link from a till figure). Callouts go to Dispatch (783).
- **Period → days:** the panel's effective period (the board's unless the panel opted out, else the view's own)
  resolved in local days, Sunday weeks; `last-N-days` ends today, matching the list's own `last7` preset. The
  server resolves the same tokens for the chart; a different "ends yesterday" rule there would shift the range by a day.
- The drill sits in 772's drill menu (shown while the panel holds the cross-filter point).
