---
status: done
spec: 342
blocked-by: 344
---

# 349 — A theft's amount or business day is corrected with the post dialog's day picker, and a collected day is refused

Builds against BackOffice 2195's `## Web contract`.

## What to build

**Prefactor first:** `BusinessDayField` (today a local function inside `PostEntryDialog.tsx`, ticket 339's
closed-day field) moves to its own file in the feature, with the post dialog unchanged in behaviour. Then:

- For a **theft only**, the change form gains a **Business day** field pre-filled with the theft's day
  (W4). Shortages and surpluses never show it.
- The body sends `newBusinessDay` as a bare date (`"2025-08-12"`) only when it differs; otherwise `null`.
  A theft request may name any non-empty set of amount, description and day; naming only the day it
  already has is "nothing differs".
- The card shows old → new day when the day moves; dates are shown as received, local wall clock.
- `THEFT_DAY_COLLECTED` (current or new day collected; also at approval) and the 400s
  `SettlementBusinessDayTheftOnly`, `SettlementTheftBusinessDayRequired`, `SettlementTheftDayNotClosed`
  are said through 344's map — the day codes land on the day field. The web does **not** shadow the
  collected-day rule (W3: it has no reliable read of it).
- An approved day-move redraws from the act response's `businessDay`.

## Spine reach

model/api (`newBusinessDay`, `businessDay` already declared by 343) · store/logic (body + nothing-differs
count the day) · component (day field in the change form, card) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `changeRequestBody` (theft cases) — day sent only for a theft and only when it differs; same-day-only
  is nothing-differs; a shortage never sends `newBusinessDay` · pure
- [x] `settlement-theft-drive` unmodified and green after the `BusinessDayField` move · flow (drive)
- [x] `settlement-change-drive` extended — a theft's form shows the day picker, a shortage's does not; a
  day-move posts the bare date; stubbed `THEFT_DAY_COLLECTED` and `SettlementTheftDayNotClosed` are said
  on the right place; an approved day-move redraws the new day · flow (drive)

## Boundaries

No new door. Touches `PostEntryDialog.tsx` only for the extraction.

## Done when

The three Proof items are green, typecheck + `npm test` pass, earlier drives unmodified and green.

## Blocked by

[344](344-every-change-request-refusal-is-said-by-its-code-with-its-next-step.md)

## Comments

**Built (2026-10-02, AFK).**
- `BusinessDayField` now lives in its own file (`BusinessDayField.tsx`). The post dialog only passes its label, hint and testId, and its behaviour is unchanged.
- **The change form:** for a theft, `asksBusinessDay` draws the day box, filled by `changeDraftFor` with the theft's bare day. `reduceToSpent` fills it the same way.
- **The body:** `changeRequestBody` sends `newBusinessDay` as a bare date only when the day moves. Otherwise a theft sends `null`, and a shortage or surplus omits the field entirely (HITL-343). Naming only the current day is nothing-differs. An emptied or unreadable box is held in the form.
- **The card:** `cardFor` compares the days as bare days. `raisedRequest` writes the new day at midnight, as History does.
- **Refusals:** the three day 400s land on the day box through 344's map. `THEFT_DAY_COLLECTED` is said in the notice line, and the form stays as typed.
- **After an approve:** an approved day-move redraws from the answer's `businessDay`, and the form reopens on the new day.

**Proof:**
- Pure: 17 theft cases in `change-request.test.ts`.
- `settlement-theft-drive`: unmodified, 62/62.
- `settlement-change-drive`: §31–34 added, 285/285.
- The other settlement drives are unmodified and green (291, 42, 41, 41).
- `npm test`: 3092 passing. Typecheck, lint and build are clean.

All proofs run against stubs of 2195's contract; no live SIS.Api was used.

**Reviews:**
- `/code-review`: 1 bug, fixed (the day in `reduceToSpent`).
- `/standards-review`: MINOR (`.afk/REVIEW-349.md`). Three judgement calls were taken: the day fields are required, the drive stubs are folded, and the card compares days.

**Owner sign-off** (`.afk/HITL-349.md`):
- Q1: `THEFT_DAY_COLLECTED` is said in the notice, not on the day box.
- Q5: an approved day-move shows through the reopened form; no separate day line was added.
