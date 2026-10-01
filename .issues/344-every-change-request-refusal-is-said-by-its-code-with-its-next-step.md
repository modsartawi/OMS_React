---
status: open
spec: 342
blocked-by: 343
---

# 344 — Every change-request refusal is said by its code, with its next step

## What to build

A refused change request is never a generic error. One **pure refusal map** (W7) turns every code in
BackOffice 2191–2195's `## Web contract` into a sentence and a **next step**, and the raise form follows
the step:

| Code | Next step |
|---|---|
| `ENTRY_NOT_OPEN` | close the pane (the entry no longer exists) |
| `ENTRY_FINAL` | redraw (cancelled / closed out / rejected) |
| `BELOW_SPENT` | refill the floor from the answer's `spentAmount` |
| `DELETE_SPENT` | offer "Reduce it to X" (wired by 347) |
| `CHANGE_ALREADY_OPEN` | open the waiting request (`changeRequestId`); re-read History when the id is `''` |
| `NO_CHANGE` | stay in the form |
| `CHANGE_STALE` | supervisor: reject with a reason |
| `CHANGE_NOT_OPEN` | redraw; `requestStatus` names applied / rejected / withdrawn / superseded |
| `NOT_REQUESTER` | none |
| `THEFT_DAY_COLLECTED` | supervisor at approval: reject with a reason |
| `WRONG_KIND`, `REMAINING_INSUFFICIENT` | the tracer's codes, mapped defensively to a generic sentence |

An unknown code falls back to the server's `message`. The **400** codes map to field errors in the form:
`SettlementAmountRequired`, `SettlementAmountRoundsToZero`, `SettlementReasonTooLong`,
`SettlementChangeReasonRequired`, `SettlementReasonRequired`, `SettlementDeleteTakesNoFigures`,
`SettlementBusinessDayTheftOnly`, `SettlementTheftBusinessDayRequired`, `SettlementTheftDayNotClosed`,
and the body/id codes (`SettlementChangeBodyRequired`, `SettlementEntryRequired`,
`SettlementChangeRequestRequired`, `SettlementChangeRequestKindInvalid`, `SettlementRejectReasonRequired`).

The map covers **all** codes now, so 345–349 render its answers rather than adding their own; this ticket
wires it into **Raise** (the only door built so far).

## Spine reach

store/logic (refusal map) · component (raise form follows the step) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `changeRefusal` — every 200 code in 2191–2195 maps to a sentence key and a next step; an unknown
  code falls back to `message`; `CHANGE_ALREADY_OPEN` with `''` asks for a History re-read · pure
- [ ] `changeFieldError` — every 400 code above maps to its field (amount / description / day / reason)
  or to the form · pure
- [ ] `settlement-change-drive` extended — `BELOW_SPENT` refills the floor, `CHANGE_ALREADY_OPEN` opens
  the named request, `NO_CHANGE` keeps the form, a 400 lands on its field · flow (drive)

## Boundaries

No new door. Words in the `settlement` namespace, keyed off the code, never off `message`.

## Done when

The three Proof items are green, typecheck + `npm test` pass, and earlier drives are unmodified and green.

## Blocked by

[343](343-an-accountant-asks-to-change-an-untouched-entry-and-the-pane-shows-it-waiting.md)
