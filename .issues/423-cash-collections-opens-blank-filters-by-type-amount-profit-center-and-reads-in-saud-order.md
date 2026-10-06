---
status: open
spec: C:/Work/DMSCO/BackOffice/.issues/2423-e-collection-feedback-filters-saud-order-monthly-acr-number-and-tighter-grants-spec.md
blocked-by: —
---

# 423 — Cash Collections opens blank, filters by Type, Amount and Profit center, and reads in Saud's order

**Source:** BackOffice spec 2423 (grilled 2026-10-06). **Live:** BackOffice 2424 adds the server
criteria. Build against a stub of the wire contract below, and do the live walk once 2424 is merged.
This replaces BackOffice ticket 2432.

## Wire contract (BackOffice 2424)

`GET CollectionWeb/Collections` gains new optional query params. They use PascalCase and bind to the
existing `CollectionInquiryOptions`. An empty value is never sent.

- `CollectionTypes` takes repeated values of `Regular`, `Short` and `OutsideSystem`, OR'd together.
- `HasSurplus` and `HasStolen` are booleans. Each one, when set, is ANDed with the other filters.
- `AmountFrom` and `AmountTo` are decimals, inclusive. A From greater than To is refused with the
  inquiry's usual criterion refusal.
- `ProfitCenter` is a string matched with contains, case-insensitive.

The server applies all of them before the 500-row cap.

## What to build

- **Open blank.**
  - `landingCriteria` (`collections-criteria.ts`) drops the today..today collection date.
  - **Served by keeps its "mine" default** (owner ruling).
  - The page issues **no request until Search** is pressed, and the empty grid says to press Search.
  - The landing chip and `isLandingQuery` move to the new landing.
  - A Search with every box empty returns the newest 500 under the existing cap notice.
- **Toolbar** (`CollectionsToolbar.tsx`):
  - **Type** is a multi-select of Regular / Short / Outside system, plus "has Surplus" and "has
    Stolen" ticks.
  - **Amount** has From and To boxes.
  - **Profit center** is a text box.
- **Saud's order.** `collections-columns.ts` follows the 31 headers in
  `C:/Work/DMSCO/BackOffice/.issues/assets/2423-saud-collection-column-order.xlsx`, in this order:
  1. Receipt No#
  2. Store Code
  3. Profit Center
  4. Sales Date
  5. Amount
  6. Surplus
  7. Net Collected
  8. Collector
  9. Collector Name
  10. Type
  11. Description
  12. Collection Date
  13. Business Date
  14. Store Name
  15. Variance
  16. Card Total
  17. Reason
  18. Opened
  19. Closed
  20. System Cash
  21. Counted Cash
  22. Float
  23. Counted (Net)
  24. Card Slips
  25. Reason Detail
  26. Z Reports
  27. Retained Float
  28. Closer Id
  29. Closer
  30. Currency
  31. Profit Center (Store)

  - The **first 13** (Receipt No# through Business Date) are visible by default. The other 18 sit
    under "More columns" in this same order.
  - Each header maps onto an existing field; no field is added. Profit Center (Store) is
    `storeText`. Card Slips is the slip-count column, still shown only when the session can see
    slips.
  - The `grid-xlsx` export follows the grid.
- Follow oms-react's `.claude/rules/`: zero i18n literals (EN and AR), logical Tailwind, bidi.

## Spine reach

UI: criteria, toolbar, columns, export · API client: query params.

## Proof (→ `tdd` red-green cycles)

- [ ] `landingCriteria has no dates and keeps servedBy` · Vitest (`collections-criteria.test.ts`)
- [ ] `new filters map to PascalCase params and empties are dropped` · Vitest
- [ ] `isLandingQuery recognises the new landing` · Vitest
- [ ] `columns follow Saud's 31 in order, first 13 visible` · Vitest (`collections-columns.test.ts`)
- [ ] `no request is issued on landing` · Vitest (page or hook test)
- [ ] Manual walk against a local SIS.Api once BackOffice 2424 is merged (owner).

## Boundaries

There is no backend change in this repo. Release after SIS.Api carries 2424. Against an older API
the new params are ignored, so the screen still works with unfiltered results.

## Done when

The Vitest proofs are green, typecheck and lint pass, and the live walk is either done or recorded as
outstanding.

## Blocked by

None in this repo. Live: BackOffice 2424.
