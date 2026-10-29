---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3201-hungerstation-promotions-are-made-on-oms-react-and-sent-to-hungerstation-spec.md
blocked-by: 667 (live: BackOffice 3213)
---

# 668 — A same-item bundle sheet with mixed values is previewed as the parts it will be sent as

## What to build

The **same-item bundle** type in the editor.

- A bundle column spec for `core/import/ImportDialog`: `Material, Buy, Get, Subtype, Value, MaxQty`.
  Blank cells take the header defaults (default buy, get, subtype, value). Buy-one-get-one-free is
  `1, 1, PERCENTAGE, 100`.
- **Part preview** from Check: one row per **HungerStation promotion part**, showing the combination
  in words ("Buy 2 get 1 at 50% off", "Buy 1 get 1 free", "Buy 2 get 1 for 9.95 SAR"), its SKU count
  and the name it will carry on HungerStation. A Send button reads "Send N promotions to M stores"
  when N > 1.
- The detail (665) shows each part's own status; one failed part makes the promotion Failed.
- The user never splits a sheet by hand. Say so on the paste step: "Rows with different buy/get or
  discount are sent as separate HungerStation promotions."

Wire shapes: the contract's Check (parts) and read sections (added by BackOffice 3213).

## Spine reach

UI → app (BackOffice doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [ ] `bundleColumns` parse: blank cells → defaults, buy/get < 1 flagged, BOGO row reads as such (vitest)
- [ ] `partLabel`: the combination in words, EN and AR, for PERCENTAGE / ABSOLUTE / FINAL_PRICE and BOGO (vitest)
- [ ] drive (LTR + RTL), against stubs: a mixed 1,000-row sheet previews 3 parts with their counts and names; Send says "3 promotions"; per-part status on the detail
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only. The split is the server's (BackOffice 3213); the page only shows it, and never
computes the parts on its own.

## Done when

A mixed bundle sheet previews as its parts and sends from stubs.

## Blocked by

[667](667-the-promotion-check-panel-shows-each-row-s-refusal-and-the-stores-a-price-warning-names.md)
