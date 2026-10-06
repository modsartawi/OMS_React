---
status: done
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

- [x] `landingCriteria has no dates and keeps servedBy` · Vitest (`collections-criteria.test.ts`)
- [x] `new filters map to PascalCase params and empties are dropped` · Vitest
- [x] `isLandingQuery recognises the new landing` · Vitest
- [x] `columns follow Saud's 31 in order, first 13 visible` · Vitest (`collections-columns.test.ts`)
- [x] `no request is issued on landing` · Vitest (page or hook test)
- [ ] Manual walk against a local SIS.Api once BackOffice 2424 is merged (owner).

## Boundaries

There is no backend change in this repo. Release after SIS.Api carries 2424. Against an older API
the new params are ignored, so the screen still works with unfiltered results.

## Done when

The Vitest proofs are green, typecheck and lint pass, and the live walk is either done or recorded as
outstanding.

## Blocked by

None in this repo. Live: BackOffice 2424.

## As built (2026-10-06, AFK)

- **Open blank:** `landingCriteria(options)` has no dates and keeps Served by's "mine" default. The
  Page's applied criteria are `null` until the first Search, `collectionsParamsFor(acrId, null)` answers
  `null`, and `useQuery` is enabled on a non-null query. That is the "no request on landing" seam
  (`collections-criteria.test.ts`). The empty grid says "Press Search to see collections". Reset
  returns to that un-searched landing. A Search on an unchanged draft re-asks the door (`sameQuery` +
  `refetch`). `?acr=` still loads at once.
- **Filters:** Type (Regular / Short / Outside system checkboxes, plus has Surplus / has Stolen),
  Amount from/to (text, sent as typed), and Profit center. All are PascalCase, empties are never sent,
  and they are disabled under `?acr=`. `core/api.ts` `buildQuery` now sends an array as a **repeated
  key** (`CollectionTypes=Regular&CollectionTypes=Short`), tested in `api.test.ts`. 424's `Kinds` can
  reuse it.
- **Saud's order:** `DEFAULT_FIELDS` holds the 13 and `MORE_FIELDS` the 18. The test reads the 31
  headers through the real en bundle; no label needed renaming. ⚠ **Card Slips (24) is
  `cardTransactionCount`**, the field whose en label it already is. The probe-gated slip count follows
  it. This departs from the ticket's "Card Slips is the slip-count column" wording; see
  `.afk/HITL-423.md`, which needs owner sign-off. The xlsx export follows the grid.
- **Proof:** vitest is 203 files / 3728 tests green, and typecheck, lint (4 gates) and build are green.
  Drives were run with the network stubbed to 2424's contract:
  - `collections-filters-drive` 59/59, which now proves no request on landing, Reset to the
    un-searched landing, the 2424 params and Saud's 13
  - `collection-drive` 260/262
  - `slip-count` 66/66, `slip-drawer` 63/63, `slip-add` 52/52, `slip-withdraw` 68/68
  - `settlement-drive` 291/291
  - `collection-print-drive` 154/156
  
  The 2 failures in `collection-drive` (ACR landing, ticket 425's) and the 2 in
  `collection-print-drive` are **identical at base 02ad20d**. `profit-center-drive` crashes in its stale
  CSV-export reader at base too; everything it checks before that point passes.

### Outstanding
- Manual walk against a local SIS.Api once BackOffice 2424 is merged (owner). 2424 is committed on
  `afk/spec2423` (81db48517) with the same wire shape.
- Owner rulings in `.afk/HITL-423.md`: the Card Slips mapping, and the cap (the spec says 500, the
  screen's shipped cap is 2,000).

