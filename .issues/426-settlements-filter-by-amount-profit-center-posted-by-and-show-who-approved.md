---
status: done
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

- [x] `ledger new filters map to URL params and satisfy the criterion rule` · Vitest (`ledger.test.ts`)
- [x] `ledger and account columns include Approved by/at after Posted at` · Vitest (`approver-columns.test.ts`)
- [x] `approved by falls back to staff id when the name is blank` · Vitest (`approver-columns.test.ts`, which also covers the audit pane naming the approver)
- [ ] Manual walk against a local SIS.Api once BackOffice 2430 is merged (owner). **Outstanding.**

**What was driven (2026-10-07, all stubbed against this ticket's wire contract):** the new
`tools/settlement-ledger-filters-drive.mjs` passes 37/37. It covers each new filter alone as a question,
the camelCase wire names, an empty value never sent, an unreadable amount refused, the Posted-by
picker (including a roster 403), the server's From > To refusal, the column order and cells on both
grids, an absent `approvedByName`, and the audit pane. Also green: `settlement-drive` 291/291 (its
stub counts the new criteria, its viewport is 2000px, and its audit reader strips isolates),
`settlement-change-drive` 374/374 (its audit reader strips isolates), `settlement-approval` 42/42,
`settlement-theft` 62/62, `settlement-supervision` 41/41 and `settlement-description` 41/41.
Typecheck, `npm test` (3,788), all four lint gates and the build are green.

Decisions are logged in `.afk/HITL-426.md`: the roster type graduated to core; a settlement-only
session gets a 403 from the roster door (a BackOffice ask); the Account grid is now wider than 1600px.
"Zero literals EN and AR" means EN plus the bidi rule, because no Arabic locale exists.

## Boundaries

There is no backend change in this repo.

## Done when

The proofs are green and typecheck and lint pass.

## Blocked by

None in this repo. Live: BackOffice 2430.
