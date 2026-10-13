# HITL — ticket 481 (Deliverect stores: store status, push hours, history)

## Q: Where do the status actions live, and on which rows?
**Decision taken:** Three row buttons — Set status, Push hours, Status history — on rows that carry a `status` block only (the 480 precedent for sync). A row whose block is null (2625 unshipped) shows none.
**Why:** The doors ship with the block; offering them before would only produce 404s.
**Revisit if:** 2625 can return `status: null` for a linked store that the doors still serve.

## Q: One dialog with a choice, or three buttons per row?
**Decision taken:** One "Set the store status" dialog (ReasonDialog) with busy / close for now / reopen as radios, NONE preselected; the delay field shows for busy only; Confirm's label follows the action (Set busy / Close store / Reopen store; close on the danger button).
**Why:** A row already carries up to seven buttons; no preselection means a stray Confirm sends nothing.
**Revisit if:** The owner wants one-click busy/close/reopen buttons.

## Q: Which actions does a store's current state offer?
**Decision taken:** Open → busy, close (no reopen). Busy → all three (busy again = a new delay). Closed → reopen ONLY. An unknown state or no status → all three (the server decides).
**Why:** Setting a closed store busy would put it back on the platforms without anyone choosing Reopen (code-review finding). The contract has no state rule; this is a client guard only.
**Revisit if:** Deliverect's busy mode on a closed location does not reopen it, or ops want busy-from-closed.

## Q: The preparation delay — what is valid?
**Decision taken:** A positive whole number in ASCII digits (`parseDelay`), refused inline otherwise; no ceiling (the contract names none); no default (the field starts empty).
**Why:** Briefing: "a positive whole number"; inventing a max or a default would be a guessed shape.
**Revisit if:** 2625 or Deliverect caps the delay.

## Q: How is an overnight shift drawn — and in which isolate?
**Decision taken:** `hoursLabel` builds ONE string: the range via `formatRange` (`08:00–02:00`), and for an overnight row the locale's `"{{range}} next day"` with the range `fsi`-isolated whole. A same-day range renders in `Ltr`; an overnight label renders in `<bdi>` (direction from its own words). Arabic: `⁨08:00–02:00⁩ اليوم التالي`.
**Why:** The briefing said "isolated once (Ltr)", but the repo's bidi rule (non-negotiable) says a range written with words isolates the value and lets the words carry the order — `Ltr` around the Arabic sentence put "next day" before the times for an Arabic reader (flagged by /code-review and both /standards-review axes). The range is still ONE isolate, never one per end.
**Revisit if:** The owner prefers the ticket's arrow form ("08:00 → 02:00 next day") — that would be a locale-template change only.

## Q: Hours day names
**Decision taken:** The contract's `"SUN"…"SAT"` map to full day words (en + ar); any other value is shown as sent, `Ltr`.
**Why:** The contract's only example is `"SUN"`.
**Revisit if:** 2625 sends other day codes (numbers, lowercase).

## Q: History — page size, order, unnamed actions
**Decision taken:** `take=50` (`STATUS_HISTORY_TAKE`, the 480 log precedent); rows shown in the door's order, with no order claimed in the copy; an action other than busy/close/reopen (the spec's log also records the hours push) is shown raw, `Ltr`. Delay column shows the number only (no plural form needed).
**Why:** The contract names no default `take`, no order and no hours-push action name.
**Revisit if:** 2625 names the hours-push action — then give it a word.

## Contract gap

- **Hours push: no body and no reason named.** The contract's Hours section names no body and the Common rule asks a reason only "where a section says so"; spec 2615's status log nonetheless records a reason for "hours push". 481 sends `{}` (as every body-less POST in the app does) and asks no reason. **Ask:** does `POST StoreStatus/{store}/Hours` take `{ reason }`? If yes it becomes a ReasonDialog.
- **Hours refusals not listed.** 481 shows DLV-00010 / DLV-00011 inline in the push dialog as for the status POST (both proven against stubs). **Ask:** list them under Hours.
- **History: no default `take`, no order, no hours-push action name.** **Ask:** state them (and whether `delayMinutes` is null for non-busy rows, as 481 assumes it may be).
- **Status POST answer unspecified.** 481 reads nothing from it and refetches the list. **Ask:** name it.

## Outstanding (not AFK's)
- Owner sign-off: the state→action guard (closed → reopen only), the overnight `<bdi>` deviation from the briefing's "(Ltr)", the Hours `{}` body.
- Owner's eye on the Arabic rendering (the app's `lng` stays `en`; the RTL drive proves direction only; vitest proves the Arabic "next day" string).
- Live doors on staging (483, BackOffice 2625).
