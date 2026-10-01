---
status: done
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

- [x] `changeRefusal` — every 200 code in 2191–2195 maps to a sentence key and a next step; an unknown
  code falls back to `message`; `CHANGE_ALREADY_OPEN` with `''` asks for a History re-read · pure
- [x] `changeFieldError` — every 400 code above maps to its field (amount / description / day / reason)
  or to the form · pure
- [x] `settlement-change-drive` extended — `BELOW_SPENT` refills the floor, `CHANGE_ALREADY_OPEN` opens
  the named request, `NO_CHANGE` keeps the form, a 400 lands on its field · flow (drive)

## Boundaries

No new door. Words in the `settlement` namespace, keyed off the code, never off `message`.

## Done when

The three Proof items are green, typecheck + `npm test` pass, and earlier drives are unmodified and green.

## Blocked by

[343](343-an-accountant-asks-to-change-an-untouched-entry-and-the-pane-shows-it-waiting.md)

## Done — 2026-10-01

- `change-refusal.ts` is one pure module. `changeRefusal(door, answer, message?)` covers every 200 code of
  2191–2195 on every door (Raise / Approve / Reject / Withdraw). Each code returns a keyed sentence and a next step.
  The step depends on the door only where the contracts give a code a second meaning at approval: `BELOW_SPENT`,
  `DELETE_SPENT`, `CHANGE_STALE` and `THEFT_DAY_COLLECTED` become "reject with a reason". `changeFieldError(code, sent?)`
  covers all 14 of the 400 codes.
- `change-refusal.test.ts` has 92 cases. It takes its code lists from the contracts, not from the module, and checks
  that every sentence key exists in `settlement.json`.
- The Raise form now follows the step:
  - `BELOW_SPENT` refills the floor from the answer before History is re-read.
  - `CHANGE_ALREADY_OPEN` closes the form and lets the re-read draw the waiting card. When the id is `''`, it also
    re-reads.
  - `NO_CHANGE` leaves the form as it was typed.
  - `ENTRY_NOT_OPEN` reduces the pane to its sentence.
  - `ENTRY_FINAL` redraws at once.
  - A 400 lands on its box: amount, Description, Reason, or the form itself. The server's `message` is shown only
    for an unknown code.
- `tools/settlement-change-drive.mjs` passes 102/102, stubbed. The earlier settlement drives are unmodified and green:
  settlement 291/291, approval 42/42, description 41/41, supervision 41/41, theft 62/62. Typecheck, `npm test` (3004),
  lint and build are green. Nothing was driven against a live SIS.Api.
- Decisions taken unattended are in `.afk/HITL-344.md`. The ones most worth the owner's eye:
  - **No `message` on an unknown 200 code on Raise.** `api.post` hands back only `data`, so the code is named
    instead. `core/api.ts` was left untouched.
  - **The per-door steps.**
  - **A consumed entry's `DELETE_SPENT` offers no reduce.** This matches 343's spent-whole decision.
