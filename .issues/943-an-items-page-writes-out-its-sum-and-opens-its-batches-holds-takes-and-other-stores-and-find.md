---
status: open
spec: BackOffice 4157
blocked-by: 942, BO 4161
---

# 943 — An item's page writes out its sum and opens its batches, holds, takes and other stores, and Find searches the fleet

Spec: BackOffice `C:\Work\DMSCO\BackOffice\.issues\4157-the-stock-console-every-stores-stock-held-and-reserved-searched-down-to-the-batch-spec.md`.

## What to build

Layout, wording and the order of things follow the accepted prototype, round 3:
`C:\Work\DMSCO\BackOffice\.scratch\proto\store-stock-console\console.html` (it makes no live call). The sync console
(`src/features/admin/sync-console`) is the model for the shape; nothing is imported from it (feature boundary).

- **The item's page**, `/stock/console/store/:store/item/:item`, read on opening:
  - **the sum, written out with this item's numbers**: SAP counter, less sold at the till and not in SAP, equals
    till-side; less held (standing, sold not applied), less reserved, equals free;
  - beside it the two other rules in use: what the channels are answered now and by which rule (with the open orders
    under the live-orders rule), and the change feed's figure, never below zero;
  - the other stock types (quality, blocked, returns, in transit, in transfer) when not zero;
  - "How this is read" for each line.
- **Tabs**, each one small read on opening: Batches (with free for the take door), Holds (open, and released in the
  last 7 days), Takes (three days), Other stores (the item at every store, paged; a row opens the item at that store).
  Movements arrives with ticket 945.
- **Find an item or a batch** (top link, `/stock/console/find`), on the search-first frame:
  - with a batch: one row per store, item and batch, with the count of rows and of stores; a row opens the item at
    that store;
  - without a batch: items by number or name; an item opens its Other stores view;
  - both boxes empty: Search says what to fill, and asks nothing.

## Spine reach

UI (item page, four tabs, Find page, wire types, api, locale files)

## Proof (→ `tdd` red-green cycles)

- [x] the sum's lines are built from the operands, in order, with reserved's three states · vitest (pure module)
- [x] "answered now" names its rule and shows the open orders only under live orders · vitest
- [x] Find asks nothing with both boxes empty, and picks the batch or the item answer by what is filled · vitest
- [x] a Find row and an Other stores row link to the item at that store · vitest
- [x] the locale key-mirror test passes · vitest

## Boundaries

As ticket 940.

## Done when

Proofs green, and on dev an item's sum reads the same as its rows, and a vendor batch is found across the fleet.

## Blocked by

[942](942-a-stores-holds-takes-feeds-and-stage-are-read-on-the-console-the-fleets-feeds-and-switches-o.md),
BackOffice [4161](C:\Work\DMSCO\BackOffice\.issues\4161-an-item-is-explained-at-a-store-and-shown-at-every-store-and-an-item-or-a-batch-is-found-acr.md)

## Comments

- 2026-11-22, web built first on `spec/4157-stock-console`, ahead of the server (owner's choice). The Proof cases are
  green under vitest, and typecheck plus the lint gates pass. The wire types follow a drafted contract (spec 4157 and
  BO 4158–4163; the "as built" deviations are recorded in the merge commits). There was no prototype on this machine,
  so the layout follows the ticket text. **Still owed before `done`:** the "on dev" Done-when check, once the BackOffice
  routes (and SIS.Stock 075–080) are deployed, and reconciling the web types with the C# DTOs as built. Status is left
  `open` until then.
