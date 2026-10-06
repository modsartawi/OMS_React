---
status: done
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

- [x] `ready landing issues no request and keeps servedBy` · Vitest (`ready-criteria.test.ts`)
- [x] `ready filters map to params; empties dropped` · Vitest
- [x] `ready columns follow the approved mapping` · Vitest (`ready-columns.test.ts`)
- [ ] Manual walk against a local SIS.Api once BackOffice 2425 is merged (owner).

## As built (2026-10-06, AFK)

- **Open blank:** this copies 423's seam. The applied criteria are `null` until the first Search,
  `readyParamsFor(null)` answers `null`, and `useQuery` is enabled on a non-null query. The landing
  says "Press Search to see what is waiting". Served by keeps "mine". Reset returns to the un-searched
  landing, and a Search on an unchanged draft re-asks the door.
- **Filters:** Type (Day / Settlement receipt checkboxes) → `Kinds` as a repeated key (core
  `buildQuery`, from 423). Amount from/to are text boxes sent trimmed as typed. Profit center is a
  text box. All params are PascalCase and empties are never sent.
- **Columns:** these follow the mapping, with Card slips (the probe-gated `slipCount`) after Days
  waiting. Currency is always a column, so the mixed-currency promotion is gone. ⚠ **Store Code is
  `storeId`.** The composed `storeText` goes to the tail with shift id and settlement document id,
  mirroring 423. Labels are unchanged ("Shortage Entry", "Waiting", "Slips"). Both points need owner
  sign-off: see `.afk/HITL-424.md`.
- **Proof:**
  - Vitest is 203 files / 3742 tests green, and typecheck, lint (4 gates) and build are green.
  - Drives ran with the network stubbed to 2425's contract:
    - `ready-drive` 57/59. It now proves: no request on landing; Reset to the un-searched landing;
      the 2425 params, including repeated `Kinds`; the 13 mapped headers; the tail.
    - `slip-count` 67/67, `slip-add` 52/52, `slip-drawer` 63/63, `slip-withdraw` 68/68.
    - `foundation` 1310/1318. Ready now presses Search before its header check.
  - The 2 `ready-drive` menu-link failures and the 8 foundation topbar/bell failures are pre-existing
    and unrelated: the rail menu is collapsed, and layout is untouched. See HITL.

### Outstanding
- Manual walk against a local SIS.Api once BackOffice 2425 is merged (owner). 2425 is committed on
  `afk/spec2423` (86235032b) with the same wire shape.
- Owner rulings in `.afk/HITL-424.md`: Store Code = `storeId`, unchanged labels, and the cap (500 vs
  2,000).

## Boundaries

There is no backend change in this repo.

## Done when

The proofs are green and typecheck and lint pass.

## Blocked by

None in this repo. Live: BackOffice 2425.
