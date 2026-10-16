---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2691-oms-react-pick-support-brief.md
blocked-by: 496
---

# 498 — Support sees every delivery stuck now, filtered by store and shape

## What to build

A **Stuck now** tab on `/oms/pick-support`, beside Search, reading `GET PickSupport/StuckNow?store=&shape=`
(brief: "the census"). The census is evaluated on demand: there is no background job and no alert,
so the page never caches it between visits.

- **Count badge** on the tab = the server's `total`, the number of distinct deliveries. Show it as
  sent; never count rows (a delivery in two shapes is two rows and counts once).
- **Filters** in URL state:
  - store: free text, or the existing store picker if one fits;
  - shape: the three codes plus "All".

  A blank filter is omitted from the call.
- **Grid** columns: delivery, order, current store, shape (as a code) and since.
  - Rows keep the server's order: oldest `since`, then delivery, then shape.
  - A `null` `since` shows "—" and sorts last.
  - A floor stamp reads "—" through 496's `readStamp`.
- **A row opens that delivery's diagnosis**, by switching to Search with `?key={deliveryNo}`, or in
  a drawer. Pick whichever keeps the shared panel and its fix dialog working, and say which in the
  ticket's comments.
- A **Refresh** button re-calls the door. A `PICK-00003` (an unknown shape typed into the URL) is
  shown with its code.
- The badge is fetched when the page opens, not only when the tab is selected. It still respects
  the "no cache between visits" rule.

## Spine reach

api (`StuckNow`) · logic (filter ↔ URL, since ordering) · tab + grid · i18n EN/AR · test

## Proof (→ `tdd` red-green cycles)

- [ ] `censusQuery`: URL state → door params; blank filters dropped; "All" drops the shape (vitest)
- [ ] `sortSince`: the server's order kept; a `null` `since` last (vitest)
- [ ] The drive (extend `tools/pick-support-drive.mjs`, LTR + RTL, a stub with one delivery in two shapes and `total` 1) checks:
  - the badge reads 1, not 2;
  - the filters survive a reload;
  - a row opens its diagnosis;
  - Refresh re-calls the door;
  - a `PICK-00003` is shown with its code.
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- One new door, `StuckNow`, stubbed until 500.
- Business code: `PICK-00003`.
- No bulk action and no "fix all": cases are worked one at a time, through the diagnosis.

## Done when

The helpers and the drive are green, and the stubbed census lists, filters and opens its rows.

## Blocked by

[496](496-pick-support-finds-a-delivery-from-any-number-and-shows-its-diagnosis.md)
