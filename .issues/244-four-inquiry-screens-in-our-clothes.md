---
type: wayfinder-ticket
wayfinder: grilling
map: 240
status: open
blocked-by: —
---

# 244 — Four inquiry screens in our clothes

## Question

The documents are facsimiles; the screens around them are ours. Settle the shape of all four —
Collection Inquiry, ACR Inquiry, Deposit Inquiry, Collection Attempts — as one conversation, since
they are variations on a single template.

Grill the user on:

- **The template.** The WPF versions are all modelled on `SalesRequestInquiry` — filter strip,
  read-only grid, Find/Clear/Export, a row action. Does the web reuse an existing oms-react inquiry
  screen as its template, and which one? (`features/oms/deliveries` and the BBY Inquiry screen are
  the candidates.)
- **Filters and defaults.** WPF Collection Inquiry offers store / collector / from–to date, with a
  `Limit` of 200. What does a supervisor actually filter by first, what is the default period, and
  what happens on an unfiltered Find. Same pass over the other three.
- **Columns.** Which columns each grid shows, in what order, and which are money (and therefore
  currency-aware). The WPF grids are the starting point, not the answer — the user may have been
  living with columns they never use.
- **Row actions and drill-down.** Collection Inquiry's `ViewReceiptCommand` opens the سند قبض.
  ACR Inquiry has a Detail button that scopes Collection Inquiry to one ACR's collections
  (`AcrId` as an exclusive filter) *and* a form button that opens the ACR document. How does that
  drill-down read on the web — a route, a filtered navigation, a side pane?
- **Nav placement and naming.** Which area (`features/oms/*` or a new one), which URL prefix, what
  the menu group is called, and what each item is called in English for an en-only UI whose
  documents are Arabic.
- **Who gets in.** The supervisor and the accountant — one permission or two? Do they see the same
  four screens? Does either see stores other than their own? Note what `243` finds about the
  existing WPF permission names and reconcile.
- **Paging and volume.** How many collections a supervisor's typical period returns, and whether
  these grids page (the `GridPager` in `@/core/ui`) or cap like the WPF `Limit`.

Use `/grilling` and `/domain-modeling`; fold any new vocabulary into `CONTEXT.md`.
