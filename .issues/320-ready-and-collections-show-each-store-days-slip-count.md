---
status: open
spec: 319
blocked-by: —
---

# 320 — Ready and Cash Collections show each store day's slip count, and filter to "No slip"

## What to build

A **Slips** column on the Ready for collection grid (`ReadyPage`) and the Cash Collections grid
(`CashCollectionsPage`), plus a **Card total** column on Ready.

- **The count.** Each row's `slipCount` (integer | null). A null draws a dash, never `0`. A real `0` draws `0`.
  - On Collections the count is keyed by **that row's own `businessDay`**, so the rows of one multi-shift
    receipt may differ. Do not merge or sum them.
  - Settlement rows are always null.
- **Card total on Ready.** `cardTotal` (number | null) is the day's confirmed card tender. A null draws a dash,
  never `0.000`. It is formatted like the grid's other money cells and goes in the currency header on the same
  terms as its neighbours. Collections already has a card total, so leave it alone.
- **Unavailable banner.** When the envelope's `slipCountsUnavailable` is `true`, show a **"Slip counts
  unavailable"** banner over the grid. The rows still render, and every count is a dash.
- **The "No slip" filter.** A client-side toggle in each toolbar that keeps `row.slipCount === 0` only. It is
  never `== 0` and never `!row.slipCount`, so a null never falls into it. It adds no server parameter. It
  follows the toolbar's Reset like the other client filters.
- **Hide the column (and the filter) unless the session may see slips.** Add a probe of
  `GET AttachmentWeb/Access` and show the column only when `data.categories` contains `"CASH_CLOSE"`, tested
  with a strict membership check. A refused probe (503 `NOT_SET_UP`, 403, a network failure) or a pending
  probe hides it. Read the probe once per screen under one shared query key, so 321–323 read the same answer.
  The probe returns `withdrawCategories` too (BackOffice 2035). Type it now as an optional `string[]` and
  leave reading it to 323.
- **Keep the envelope's sibling.** `api.get` returns `data` alone, so `slipCountsUnavailable` is lost. Add one
  read to `src/core/api.ts` that returns the whole envelope (or `data` plus its named siblings), with the same
  base, credentials, `X-Web-Client` header, 401 redirect and error taxonomy as `get`. Move `ready()` and
  `collections()` onto it. Update every caller, and change no other behaviour of those screens.
- The count is **not** clickable yet. The drawer is 321's.

## Contract

Build against BackOffice
[2034](C:\Work\DMSCO\BackOffice\.issues\2034-ready-and-collections-show-each-store-days-slip-count.md)'s
`## Web contract` (the Ready, Collections, column and filter sections), stubbed exactly. Cross-check it against
`CollectionReadyRowModel.cs`, `CollectionInquiryModel.cs`, `SlipCountedResponse.cs` and
`AttachmentWebEndpoints.cs` (the Access answer) on BackOffice `pricing2`. Add no field the contract does not
name.

## Proof

- [ ] vitest on the pure modules:
  - the projection draws null → dash and a real 0 → `0`, for `slipCount` and `cardTotal`;
  - the "No slip" predicate keeps `0` and drops `null`, `undefined` and every positive count (mutation-check
    `=== 0` → `== 0` / `!x` and see it go red);
  - the access predicate is true only for a `categories` array holding `"CASH_CLOSE"`, and false for a
    refusal, a missing field, `"CASH_CLOSE"` as a bare string and an empty array;
  - the core envelope read keeps `slipCountsUnavailable` and still throws the usual `ApiError` taxonomy.
- [ ] A drive (`tools/*-drive.mjs`, stubbed, no live SIS.Api) on both grids covers:
  - the column shown and hidden by the probe, including a 503 `NOT_SET_UP` probe;
  - dashes for null;
  - the banner on `slipCountsUnavailable: true`;
  - the filter keeping only the `0` rows;
  - loading, empty, error and refusal still as before.
- [ ] Sibling drives unchanged: `ready-drive`, `collection`, `collections-filters`, `four-filters`.
- [ ] `typecheck`, `lint` (all three gates), `build` and `npm test` green.

## Boundaries

- No new route, menu leaf or grant. Ready and Collections keep their own access flags.
- No server-side filter parameter. The grids already page, sort and filter in the browser (F3).
- i18n zero-literal: the column headers, the banner, the filter label and the dash's accessible text all go
  through `t()`.
- Do not show a count as a link or button yet (321).

## Done when

A collection accountant sees each store day's slip count on both grids, and a dash where it is unknown. They
can filter to the days with none, see a banner when counts could not be read, and see the day's card total on
Ready. A session without the slip grant, or a server without a File Server key, sees neither the column nor the
filter.

## Blocked by

- BackOffice [2034](C:\Work\DMSCO\BackOffice\.issues\2034-ready-and-collections-show-each-store-days-slip-count.md): **done** (merged `da71a9621`).

## Open questions

- The new core read's name and shape (`api.getEnvelope<T, S>` versus a narrower `api.getWith(path, params,
  siblings)`). Choose whichever keeps `core/` from learning a feature's field names, and record the choice
  in the comments.
