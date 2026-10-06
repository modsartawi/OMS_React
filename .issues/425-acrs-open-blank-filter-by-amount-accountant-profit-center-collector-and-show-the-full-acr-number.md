---
status: done
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

- [x] `acr landing has no dates and issues no request` · Vitest (`acr-criteria.test.ts`)
- [x] `ACCOUNTANT offered on ACRs, not on Deposits or Attempts` · Vitest (`served-by.test.ts`)
- [x] `acr filters map to params; ACR No# is sent as text` · Vitest
- [x] `acr columns and header show acrNo; legacy shows the plain number` · Vitest (`acr-columns.test.ts`, `acr-header.test.ts`)
- [ ] Manual walk against a local SIS.Api once BackOffice 2426–2428 are merged (owner).

## Boundaries

There is no backend change in this repo. Against an older API with no `acrNo`, fall back to
`acrNumber`.

## Done when

The proofs are green and typecheck and lint pass.

## Blocked by

None in this repo. Live: BackOffice 2426, 2427, 2428.

## Comments

**2026-10-06 — built AFK (/implement).** Decisions are in `.afk/HITL-425.md` (not committed).

- **Proofs, all vitest:**
  - `acr-criteria.test.ts` covers the landing, the params and the ACR No# as text.
  - `served-by.test.ts` covers *ACCOUNTANT offered on ACRs, not on Deposits or Attempts*.
    - The ticket's "Deposits and Attempts share the collector reading" is wrong for Attempts, which have been on the assignment reading with Accountants since ticket 316.
    - Per the runner's ruling, Attempts are left exactly as shipped, and the test pins them unchanged.
    - Whether Attempts should lose ACCOUNTANT is an **open owner ruling**.
  - `acr-columns.test.ts` and `acr-header.test.ts` cover acrNo, legacy numbers and the fallback.
  - The new `acr-number.test.ts` covers deposit lines.
  - `xlsx.test.ts` covers the exported number.
- **Seam:** 423's, copied. Applied criteria are `null` until Search, and `acrsParamsFor(null)` is `null`, so the query is enabled on that. Reset returns to the un-searched landing, and a repeated Search re-asks the door.
- **Served by:** the ACRs contract now has `accountants: true`, and `resolvedKinds` adds ACCOUNTANT for that screen only. An accountant still lands on the estate.
- **ACR number:** the client shows the server's `acrNo` as sent and falls back to `acrNumber` (or to `acrNumberText` on the form). It never builds, parses or sorts the number, and the ACR No# column is not sortable. The header and deposit lines wrap the number in `Ltr`.
- **Drives, all stubbed:**
  - New: `tools/acr-filters-drive.mjs` 37/37.
  - Updated: `acr-closed-by-drive` 41/41, `four-filters-drive` 83/83, `collection-drive` 264/264, `foundation-drive` (its 8 failures are pre-existing and unrelated), `collection-print-drive` (its 2 failures are pre-existing and unrelated).
- **Gates:** typecheck, vitest (3766), lint (4 gates) and build are green.
- **Outstanding:**
  - The owner's manual walk against a local SIS.Api once BackOffice 2426–2428 are merged.
  - Owner sign-off on the unsortable ACR No# column and on the Attempts-ACCOUNTANT question.
