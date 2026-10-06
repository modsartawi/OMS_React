---
status: open
spec: C:/Work/DMSCO/BackOffice/.issues/2423-e-collection-feedback-filters-saud-order-monthly-acr-number-and-tighter-grants-spec.md
blocked-by: —
---

# 425 — ACRs open blank, filter by Amount, Accountant, Profit center and Collector, and show and search the full ACR number

**Source:** BackOffice spec 2423 and ADR 0066 (`C:/Work/DMSCO/BackOffice/docs/adr/0066-*.md`).
**Live:** BackOffice 2426 (filters), 2427 (`acrNo`) and 2428 (text search). Build against a stub of
the contract below. This replaces BackOffice ticket 2434.

## Wire contract

`GET CollectionWeb/Acrs` gains new optional params, in PascalCase:

| Param | Values | Match |
|---|---|---|
| `AmountFrom`, `AmountTo` | decimal, on the **banked** total | inclusive |
| `ProfitCenter` | string | contains; an ACR matches when any linked collection's branch matches |
| `CollectorText` | string | contains, on the collector's id **or** name; ANDs with Served by |

- `ServedByKind=ACCOUNTANT` with `ServedById` is now accepted **on ACRs only**. It returns ACRs with
  any linked collection from a branch assigned to that accountant. Deposits and Attempts still refuse
  it.
- `AcrNumber` becomes **text** and is sent as typed. The server parses each form:

  | Typed | Matches |
  |---|---|
  | `6498-2610-0001` | that one ACR exactly |
  | `2610-0001` | that month and number |
  | `0001` | that number in any month, plus a legacy plain number |

  The bare forms are narrowed by Collector or Served by. Anything malformed is refused.
- Rows and the ACR model gain `acrNo` (string) beside `acrNumber`.
  - A new ACR reads `<collector id>-YYMM-NNNN`.
  - A legacy ACR's `acrNo` is its plain number.
  - Rows sort by month, newest first, then number; legacy rows come last.

## What to build

- **Open blank.**
  - `acr-criteria.ts` drops the 2026-09-27 today..today landing.
  - Served by keeps its default; an accountant still lands on the estate, as today.
  - Status stays All.
  - The page issues no request until Search is pressed.
- **Toolbar** (`AcrsToolbar.tsx`):
  - Amount From / To (banked)
  - Profit center (text)
  - Collector (text)
  - ACR No# as a text box
- **Accountant in Served by on ACRs only.** `RESOLVED_KINDS_BY_READING` (`served-by.ts`) is keyed by
  reading, and Deposits and Attempts share the `collector` reading, which must NOT offer ACCOUNTANT.
  Split the reading or key it per screen, and rewrite the "ACCOUNTANT is absent here permanently"
  comment to name the ACR exception (BackOffice spec 2423 reverses ticket 1993 for ACRs).
- **Show `acrNo`** everywhere an ACR number is shown: the grid (`acr-columns.ts`), the header
  (`acr-header.ts`), `DepositDetail.tsx` (deposit lines gain `acrNo` too, from BackOffice 2428), and
  the fixture.
- Zero i18n literals (EN and AR).

## Spine reach

UI: criteria, toolbar, served-by, columns, header, deposit detail · API client.

## Proof (→ `tdd` red-green cycles)

- [ ] `acr landing has no dates and issues no request` · Vitest (`acr-criteria.test.ts`)
- [ ] `ACCOUNTANT offered on ACRs, not on Deposits or Attempts` · Vitest (`served-by.test.ts`)
- [ ] `acr filters map to params; ACR No# is sent as text` · Vitest
- [ ] `acr columns and header show acrNo; legacy shows the plain number` · Vitest (`acr-columns.test.ts`, `acr-header.test.ts`)
- [ ] Manual walk against a local SIS.Api once BackOffice 2426–2428 are merged (owner).

## Boundaries

There is no backend change in this repo. Against an older API with no `acrNo`, fall back to
`acrNumber`.

## Done when

The proofs are green and typecheck and lint pass.

## Blocked by

None in this repo. Live: BackOffice 2426, 2427, 2428.
