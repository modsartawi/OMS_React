# HITL log — ticket 349 (a theft's amount or business day)

## Q: Where is `THEFT_DAY_COLLECTED` said on a raise — the day box or the notice line?
**Decision taken:** The notice line above the form (344's map, step `stay`), not the day box. The form stays as typed.
**Why:** 2195 answers this code for an amount-only change, a Description-only change and a delete too, when the CURRENT day is collected. Putting it on the day box would blame a box the accountant never touched. "The day codes land on the day field" is taken to mean the three day 400s.
**Revisit if:** the owner wants it on the day box when the request moved the day (the code alone cannot tell current-day from new-day).

## Q: What does an emptied day box on a theft mean — "leave the day as it is", or a problem?
**Decision taken:** A problem: held as `businessDay: 'blank'` and said on the box. Only an absent draft field (the box never drawn) leaves the day as it is. A theft the server holds with no day (year-1) may leave the box empty.
**Why:** An empty box reads as "no day". Silently sending `null` (keep the day) would contradict what the screen shows.
**Revisit if:** the owner prefers "empty = unchanged".

## Q: `newBusinessDay` on a shortage or surplus — omitted, or sent as `null`?
**Decision taken:** Omitted entirely (343's ruling, HITL-343). A theft always names it: the bare date when it moves, `null` when it does not.
**Why:** 2195 400s `SettlementBusinessDayTheftOnly` on the field for a shortage. The ticket says "otherwise null" for a theft. Omission keeps every earlier drive's body byte-for-byte.
**Revisit if:** a server version starts requiring the key on a theft-less body.

## Q: How is the card drawn from a raise answer written, when the body carries a bare day?
**Decision taken:** `raisedRequest` writes the new day as `"yyyy-MM-ddT00:00:00"`, the midnight stamp History and the act response use. The re-read's own row replaces it.
**Why:** It compares and draws like the old day. A bare `"2025-08-12"` parses as UTC midnight in `new Date`, which a negative-offset reader would draw a day early.
**Revisit if:** History ever sends the day bare.

## Q: Where does the pane show that an approved day-move landed?
**Decision taken:** Through the change form, which reopens on the answer's `businessDay` (`changeDraftFor(now)`), and the toast. No separate "Business day" line is added to the pane's ask state. The entry panel's other panes still read the account row until it is re-read.
**Why:** It is the smallest surface that redraws from the answer (W8) without adding a new line of copy. The journal pane's "It names business day X" is EntryJournal's, from the account row, and catches up on the re-read.
**Revisit if:** the owner wants the theft's current day stated in the change-request pane itself.

## Q: Does a theft's change form still show "Lowest allowed: 0.00"?
**Decision taken:** Yes, unchanged. The floor is `offerFor`'s cell (the server's `spentAmount`, 0 for a theft).
**Why:** The form draws the cell as handed. Hiding the line per kind would be a kind test beside the offer module.
**Revisit if:** the owner finds the line noise on a theft.
