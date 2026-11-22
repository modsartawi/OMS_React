---
status: open
spec: BackOffice 4157
blocked-by: 941, BO 4160
---

# 942 — A store's holds, takes, feeds and stage are read on the console, the fleet's feeds and switches once, and a flag opens its list

Spec: BackOffice `C:\Work\DMSCO\BackOffice\.issues\4157-the-stock-console-every-stores-stock-held-and-reserved-searched-down-to-the-batch-spec.md`.

## What to build

Layout, wording and the order of things follow the accepted prototype, round 3:
`C:\Work\DMSCO\BackOffice\.scratch\proto\store-stock-console\console.html` (it makes no live call). The sync console
(`src/features/admin/sync-console`) is the model for the shape; nothing is imported from it (feature boundary).

- **Holds** (search-first frame): take id, item and name, batch, quantity, taken at, age, state, source, picking
  document or till sale; state filter (standing and sold not applied by default; standing; sold not applied; released
  in the last 7 days, which adds when and why); oldest first.
- **Takes** (search-first frame, with a day, today by default): time, kind (granted, refused, failed), item, quantity,
  the batches taken or the batch the door named, the reason of a refusal, the status of a failure. With an item or a
  batch in the boxes, a line says failed calls are not searchable by item.
- **Feeds** (read on opening the tab): the store's SAP place and last attempt, its till place and last attempt, the
  nightly comparison.
- **Stage and count** (read on opening the tab): stage, stage log, last seed run, gates toward Blocking. Read-only: no
  move from here.
- **Feeds and switches** (top link, `/stock/console/fleet`): each feed's last full pass and its age, the reserved
  recompute, the held-served switch, the hold ledger reader, today's take door figures. A fact with no answer says so.
- **The fleet line** above the stores list: the fleet facts that are a problem now, once, linking to Feeds and
  switches.
- **A flag opens its list**: clicking a flag on a store's header opens the right tab with its filter set and the
  search run (below zero: Items; old hold and sales not applied: Holds; placeholder stock: Batches; comparison
  differs: Feeds). A click on a flag counts as asking.

## Spine reach

UI (four tabs, the fleet page, the fleet line, flag links, wire types, api, locale files)

## Proof (→ `tdd` red-green cycles)

- [ ] each flag maps to its tab, filter and a search that ran · vitest
- [ ] a hold's age and state cell, and the released columns · vitest
- [ ] a take row's cells per kind, and the "failed calls not searchable" line · vitest
- [ ] a fleet fact with no answer renders as no answer, not as healthy · vitest
- [ ] the locale key-mirror test passes · vitest

## Boundaries

As ticket 940. No order number of a customer and no personal data is on any of these lists: only what the route
answers is shown.

## Done when

Proofs green, and on dev a click on "items below zero" on a store's header lists those items.

## Blocked by

[941](941-a-stores-page-reads-its-header-fresh-and-searches-its-items-and-batches-only-when-asked.md),
BackOffice [4160](C:\Work\DMSCO\BackOffice\.issues\4160-a-stores-holds-takes-feeds-and-stage-reach-the-stock-console-and-the-fleets-feeds-and-switch.md)
