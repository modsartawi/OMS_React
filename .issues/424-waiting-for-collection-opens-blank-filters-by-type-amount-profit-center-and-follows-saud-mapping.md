---
status: open
spec: C:/Work/DMSCO/BackOffice/.issues/2423-e-collection-feedback-filters-saud-order-monthly-acr-number-and-tighter-grants-spec.md
blocked-by: —
---

# 424 — Waiting for collection opens blank, filters by Type, Amount and Profit center, and follows Saud's mapping

**Source:** BackOffice spec 2423. **Live:** BackOffice 2425. Build against a stub of the contract
below. This replaces BackOffice ticket 2433.

## Wire contract (BackOffice 2425)

`GET CollectionWeb/Ready` gains new optional params, in PascalCase. The server applies each one to
both the DAY rows and the SETTLEMENT rows, before the cap. An empty value is never sent.

| Param | Values | Match |
|---|---|---|
| `Kinds` | repeated `DAY` / `SETTLEMENT` | |
| `AmountFrom`, `AmountTo` | decimal, on cash to hand over | inclusive |
| `ProfitCenter` | string | contains |

## What to build

- **Open blank.** Ready already has no date default. Served by keeps its "mine" default, and the
  page issues no request until Search is pressed.
- **Toolbar** (`ReadyToolbar.tsx`):
  - Type: Day / Settlement receipt
  - Amount: From and To
  - Profit center: text
- **Column order** (`ready-columns.ts`), as mapped from Saud's sheet by the owner:
  1. Entry No
  2. Store Code
  3. Profit Center
  4. Cash to hand over
  5. Surplus deducted
  6. Type (kind)
  7. Business Day
  8. Store Name
  9. Card Total
  10. Currency
  11. Z No
  12. Ready since
  13. Days waiting
  14. Card slips (only when slips are visible, as today)

  Store id, shift id and settlement document id stay under "More columns".
- Zero i18n literals (EN and AR), per oms-react's rules.

## Spine reach

UI: criteria, toolbar, columns · API client.

## Proof (→ `tdd` red-green cycles)

- [ ] `ready landing issues no request and keeps servedBy` · Vitest (`ready-criteria.test.ts`)
- [ ] `ready filters map to params; empties dropped` · Vitest
- [ ] `ready columns follow the approved mapping` · Vitest (`ready-columns.test.ts`)
- [ ] Manual walk against a local SIS.Api once BackOffice 2425 is merged (owner).

## Boundaries

There is no backend change in this repo.

## Done when

The proofs are green and typecheck and lint pass.

## Blocked by

None in this repo. Live: BackOffice 2425.
