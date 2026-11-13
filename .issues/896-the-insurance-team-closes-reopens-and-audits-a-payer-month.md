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

- [x] The leaf and the page are hidden when the access probe says no · oms-react tests
- [x] Close without a reason is not sent · oms-react tests
- [x] The page opens without `activity`; "Show payers with activity" sends `activity=true` · oms-react tests
- [x] Close all is offered only after the activity list is read, sends one request, and the list re-reads · oms-react tests
- [x] Reopen shows on a closed row only, and its history shows both acts · oms-react tests
- [x] The corrections count shows on the close action · oms-react tests
- [ ] A walk against SIS.Api staging with a user holding `INSURANCE_TEAM`, recorded under `## Comments`

## Boundaries

oms-react only; the routes exist. Deploy needs the BackOffice seed `Seed-InsurancePayerMonth-Screen-Authorization.sql`
on the OMS-HQ DB and someone given the `INSURANCE_TEAM` role (the seed gives it to nobody).

## Done when

An insurance-team member closes a payer's month, closes a whole month, reopens one, and reads its history and
corrections, from the web.

## Blocked by

None. BackOffice 1642 and 1648 are done (`pricing2` `ff890e705`), and 1644 (`d30fc7b01`) added the `activity` read.

## Comments

**2026-11-13 — built, stubbed; stays `open` for the staging walk.** `/insurance-rules/payer-months`
(`features/insurance-rules/payer-month`, ns `insurance-payer-month` EN + AR), a leaf in the Insurance rules group.
It has its own `InsurancePayerMonthWeb/Access` probe, not the area's. The leaf and the page's `ScreenGate` share one key and fail closed.

- **Tests** (vitest): `payer-month-rules.test.ts`, `api.test.ts` (at the `@/core/api` seam), `i18n-keys.test.ts` (EN/AR
  mirror, six Arabic plural forms), `src/layout/menu-payer-month.test.ts` (leaf hidden on no / pending / error /
  malformed); `menu-access-852.test.ts` learns the new key. Full suite 10600/10600, build and lint gates green (the
  boundary gate's four hits are the pre-existing `aliases/door-shapes.test.ts`).
- **Drive** `tools/insurance-payer-month-drive.mjs`: 50/50 against stubbed envelopes shaped from the BackOffice DTOs
  (opening read without `activity`, CSRF header, blank / whitespace / 513-character reasons not sent, Close and
  Reopen bodies without an actor, history with both acts, the register, Close all as one request that names no
  payer and then re-reads both lists, coming back to a scanned month does not re-scan, a typed year, INS-16264 in
  the dialog, the denial, RTL layout). RTL here flips direction only: the app's `lng` stays `en` until Arabic is
  switched on, so the Arabic copy is proved by the key test.
- **Review fixes** (`/code-review` + `/standards-review`): leaving a month forgets the activity press (it no longer
  re-scans when you come back); the year field keeps what is typed; the reason is counted trimmed, as the ledger
  counts it; the ledger stays on screen while the scan runs; the dialog keeps its words while closing; counts in
  `t()` sentences are isolated (`counted()` → `{{n}}`); Close all re-reads the activity list too, because its answer
  omits payers that only have a correction; register amounts are shown at scale 3 (spec K9); the dead `period.label` key is gone.
- **Left as is, for a ruling:** (1) Close all's stated count is the activity list's length; the server closes
  activity ∪ ledger. That differs only for a payer that has a correction but no sale, or for a payer id whose case
  or padding differs. (2) The close dialog states the corrections count but does not link to the register (it is one
  click away, under History on the row). (3) CONTEXT.md does not yet define payer month, ledger, close all, or the
  corrections register; `/domain-modeling` owes them.
- **Still owed:** the staging walk with an `INSURANCE_TEAM` user, after the BackOffice seed
  `Seed-InsurancePayerMonth-Screen-Authorization.sql` is applied and someone holds the role.
