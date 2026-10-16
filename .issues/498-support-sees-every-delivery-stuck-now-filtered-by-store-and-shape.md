---
status: done
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

- [x] `censusQuery`: URL state → door params; blank filters dropped; "All" drops the shape (vitest)
- [x] `sortSince`: the server's order kept; a `null` `since` last (vitest)
- [x] The drive (extend `tools/pick-support-drive.mjs`, LTR + RTL, a stub with one delivery in two shapes and `total` 1) checks:
  - the badge reads 1, not 2;
  - the filters survive a reload;
  - a row opens its diagnosis;
  - Refresh re-calls the door;
  - a `PICK-00003` is shown with its code.
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- One new door, `StuckNow`, stubbed until 500.
- Business code: `PICK-00003`.
- No bulk action and no "fix all": cases are worked one at a time, through the diagnosis.

## Done when

The helpers and the drive are green, and the stubbed census lists, filters and opens its rows.

## Blocked by

[496](496-pick-support-finds-a-delivery-from-any-number-and-shows-its-diagnosis.md)

## Comments

**Done 2026-10-16 (AFK).** Built to the brief's "GET PickSupport/StuckNow" section and its "Stuck now tab".

- **How a row opens its diagnosis:** it switches to **Search with `?key={deliveryNo}`** (the conservative choice). The shared panel and its fix dialog are reused exactly as they are, with no drawer. When Search already holds that key, the lookup and the diagnosis are asked again, as the Search box does for a repeated number. A double click on a row opens it as well.
- **Layout:**
  - `features/oms/pick-support/census-view.ts` is pure:
    - `censusQuery` turns the URL into door params. Blank filters are dropped, "All" drops the shape, and an unlisted shape is sent on for the server to refuse.
    - `sortSince` keeps the server's order and moves an unwritten `since` last.
    - `compareSince` is the header sort. It never parses a stamp, and an unwritten stamp sorts last both ways.
    - `pageFromParams` / `pageToParams` give ONE URL reading for the whole page (`tab`, `key`, `delivery`, `store`, `shape`), so a write from one tab keeps the other's state. Search stays the default and writes no `tab`.
  - `StuckNowTab.tsx` holds the filters and the AG Grid. Its columns are delivery, order, current store, shape (as a code), since and Open.
  - `pickSupportApi.stuckNow` and `pickSupportKeys.census` live in `core/pick-support/api.ts`, under the one key root, so 497's fix dialog re-reads the census when it closes.
- **Behaviour:**
  - The census query lives at the page level, so the badge is read when the page opens, even on Search.
  - `gcTime: 0` means nothing is kept between visits. Refresh calls `refetch`.
  - The badge is `total` as sent. On an error it is hidden.
  - A refusal (such as `PICK-00003`) shows its code beside the server's sentence through `PickSupportFailureBanner`.
  - An empty grid reads "Nothing is stuck". With a filter set it reads "…for these filters".
  - The tab strip follows the tabs pattern: one Tab stop, and the arrow keys move between tabs.
- **Proof:**
  - vitest: `census-view.test.ts` has 16 tests. The full suite passes, 299 files and 5229 tests.
  - `tools/pick-support-drive.mjs` passes **221/221** in LTR and RTL. 497's 178 checks still pass, and 498 adds 43 (checks 22–27). The stub holds one delivery in two shapes with `total` 1, and sends the null-`since` row first. The drive checks:
    - the badge reads 1, not 2, on page open;
    - the null since is moved last and reads "—";
    - the since and the delivery read LTR under RTL;
    - the filters reach the door (a blank one and "All" are dropped) and survive a reload;
    - Refresh, and a page revisit, each re-call the door;
    - a row opens its diagnosis as `?key=`;
    - the arrow keys move between tabs;
    - `PICK-00003` is shown with its code.
  - typecheck, lint (four gates) and build are green.
- **Decisions:** see `.afk/HITL-498.md`, which is not committed.
- **Outstanding, not this ticket's:** the live StuckNow door on staging (ticket 500).
