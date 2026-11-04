---
status: open
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

- [ ] `period → Deliveries filter: a relative period resolves to the same from–to the Deliveries list expects` · pure (vitest)
- [ ] `drill from a store opens Deliveries filtered to that store and period; till value offers no detail drill` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

Touches `features/oms/deliveries` (its URL entry only). The analytics feature links by route string and never imports it.

## Done when

The drive lands on a filtered Deliveries list from a board.

## Blocked by

[772](772-clicking-a-mark-cross-filters-the-other-panels-and-drill-by-keeps-a-breadcrumb.md)

## Open questions

Which Deliveries filters can a URL carry today without changing its saved-view bundles? Settle that first in the ticket.
