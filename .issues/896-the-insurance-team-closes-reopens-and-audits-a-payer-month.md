---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\1623-insurance-returns-and-the-patient-amount-correction-spec.md (tickets 1628, 1639; grilling 2026-11-12, decision A3)
blocked-by: —
---

# 896 — The insurance team closes, reopens and audits a payer month from the web

## What to build

The React view over the payer-month routes BackOffice shipped in 1628 and 1639 ("the React view" both tickets left
open). Once a payer's month is closed, NewPos tills refuse insurance returns and corrections for that month.

- **Menu leaf** under Insurance, shown only when `GET InsurancePayerMonthWeb/Access` says yes; the page's route guard
  reads the same probe (ticket 852's pattern).
- **Month view**: pick year and month → `GET InsurancePayerMonthWeb/Months/{year}/{month}`: the payers the ledger
  already holds a row for, plus the payers with a correction that month; open/closed, who, when, why. This read is
  cheap and is the page's opening read (BackOffice 1644).
- **Show payers with activity**: a button that re-reads with `?activity=true`, adding every payer with sales in the
  month. It scans the month's sales on the OMS-HQ database, so it runs only when pressed, never on open or on a
  timer. Close all is offered only after this list has been read, and states its count from it.
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
- [ ] The page opens without `activity`; "Show payers with activity" sends `activity=true` · oms-react tests
- [ ] Close all is offered only after the activity list is read, sends one request, and the list re-reads · oms-react tests
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

None. BackOffice 1642 and 1648 are done (`pricing2` `ff890e705`), and 1644 (`d30fc7b01`) added the `activity` read.
