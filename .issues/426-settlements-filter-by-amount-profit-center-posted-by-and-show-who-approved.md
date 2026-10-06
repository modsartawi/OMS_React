---
status: open
spec: C:/Work/DMSCO/BackOffice/.issues/2423-e-collection-feedback-filters-saud-order-monthly-acr-number-and-tighter-grants-spec.md
blocked-by: —
---

# 426 — Settlements filter by Amount, Profit center and Posted by, and show who approved

**Source:** BackOffice spec 2423. **Live:** BackOffice 2430. Build against a stub of the contract
below. This replaces BackOffice ticket 2435.

## Wire contract (BackOffice 2430)

`Settlement/Ledger` gains three new criteria, which travel as URL params like the existing ones. Any
one of them alone satisfies the "at least one criterion" rule (`SettlementLedgerCriterionRequired`).

| Param | Values | Match |
|---|---|---|
| `amountFrom`, `amountTo` | decimal, on the entry's amount | inclusive |
| `profitCenter` | string, on the entry's branch | contains |
| `postedByStaffId` | staff id | exact |

Ledger and Account rows gain `approvedByStaffId`, `approvedByName` and `approvedAt`.
`approvedByName` is blank on entries approved before 2430.

## What to build

- **Ledger filters** (`LedgerView.tsx`, `ledger.ts`):
  - Amount From / To.
  - Profit center (text).
  - Accountant: a posted-by picker built from the roster's accountants (`AssignmentOptions`).
  - Each one counts as a criterion.
- **Columns:**
  - "Approved by" shows `approvedByName`, falling back to `approvedByStaffId` when the name is blank.
  - "Approved at" sits after "Posted at".
  - Both go on `ledger-columns.ts` and `account-columns.ts`.
- **Audit pane** (`settlement/audit.ts`) names the approver.
- Zero i18n literals (EN and AR).

## Spine reach

UI: ledger filters, columns, audit pane · API client.

## Proof (→ `tdd` red-green cycles)

- [ ] `ledger new filters map to URL params and satisfy the criterion rule` · Vitest (`ledger.test.ts`)
- [ ] `ledger and account columns include Approved by/at after Posted at` · Vitest
- [ ] `approved by falls back to staff id when the name is blank` · Vitest
- [ ] Manual walk against a local SIS.Api once BackOffice 2430 is merged (owner).

## Boundaries

There is no backend change in this repo.

## Done when

The proofs are green and typecheck and lint pass.

## Blocked by

None in this repo. Live: BackOffice 2430.
