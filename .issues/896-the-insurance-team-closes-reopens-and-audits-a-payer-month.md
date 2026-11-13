---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\1623-insurance-returns-and-the-patient-amount-correction-spec.md (tickets 1628, 1639; grilling 2026-11-12, decision A3)
blocked-by: BackOffice 1648, BackOffice 1642
---

# 896 — The insurance team closes, reopens and audits a payer month from the web

## What to build

The React view over the payer-month routes BackOffice shipped in 1628 and 1639 ("the React view" both tickets left
open). Once a payer's month is closed, NewPos tills refuse insurance returns and corrections for that month.

- **Menu leaf** under Insurance, shown only when `GET InsurancePayerMonthWeb/Access` says yes; the page's route guard
  reads the same probe (ticket 852's pattern).
- **Month view**: pick year and month → `GET InsurancePayerMonthWeb/Months/{year}/{month}`: one row per payer with
  activity (or a ledger row), open/closed, who, when, why.
- **Close one payer**, **Close all** for the month, **Reopen**: `POST …/Close`, `…/CloseAll`, `…/Reopen`, each with a
  **required reason** (max 512 characters, counted in the field, the column's width per BackOffice 1648). Close all
  states how many payers it will close and asks once.
- **History** of a payer-month: `GET …/Audit/{customerId}/{year}/{month}`.
- **Corrections register** for the payer-month: `GET …/Corrections/{customerId}/{year}/{month}`, with the count on the
  close action (1639).
- Cookie session + CSRF, as the coupon admin screens. The actor is never sent: the server reads it from the session.
- Arabic beside English, RTL-correct, like the other insurance screens.

## Proof (→ `tdd` red-green cycles)

- [ ] The leaf and the page are hidden when the access probe says no · oms-react tests
- [ ] Close without a reason is not sent · oms-react tests
- [ ] Close all sends one request and the list re-reads · oms-react tests
- [ ] Reopen shows on a closed row only, and its history shows both acts · oms-react tests
- [ ] The corrections count shows on the close action · oms-react tests
- [ ] A walk against SIS.Api staging with a user holding `INSURANCE_TEAM`, recorded under `## Comments`

## Boundaries

oms-react only; the routes exist. Deploy needs the BackOffice seed `Seed-InsurancePayerMonth-Screen-Authorization.sql`
on the OMS-HQ DB and someone given the `INSURANCE_TEAM` role (the seed gives it to nobody).

## Done when

An insurance-team member closes a payer's month, closes a whole month, reopens one, and reads its history and
corrections, from the web.

## Blocked by

BackOffice [1648](C:\Work\DMSCO\BackOffice\.issues\1648-an-over-long-close-reason-aborts-the-month-end.md),
BackOffice [1642](C:\Work\DMSCO\BackOffice\.issues\1642-the-payer-month-close-and-its-audit-row-are-not-atomic.md)
