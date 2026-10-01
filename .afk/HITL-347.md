# HITL log — ticket 347 (delete, and "Reduce it to X" on a spent entry, spec 342 W5)

## Q: Does a supervisor see "Delete now" in 347, before 348 adds "applies immediately — no approval step"?
**Decision taken:** Yes. The cell is drawn as `offerFor` decides it (HITL-343's ruling for "Change now"): the button reads **Delete now** (`data-mode="now"`), the delete form submits as "Delete entry N now", and its intro says what a delete does ("Deleting cancels entry N: it keeps its number and its history…") without claiming "at once / no approval step". An `APPLIED` answer toasts "Entry N is cancelled." and redraws the entry as finished from the answer. The form's *applies immediately* sentence stays 348's.
**Why:** Hiding the supervisor's cell, or wording it "Request delete" when the server applies it at once, would both be wrong; the sentence is 348's ticket, not this one's.
**Revisit if:** 348 lands late and the interim "Delete now" without the warning sentence is judged unsafe.

## Q: A `DELETE_SPENT` answer redraws the cell as "reduce" (W8) AND 344's step says "reduce to X". Where is it said?
**Decision taken:** The sentence once, in the notice (344's "The branch has spent X from entry N, so it cannot be deleted."). The **Reduce it to X** button is the cell's, never the notice's: 344's `reduce` step closes the delete form, and the cell (W8: redrawn from the answer, so X is the ANSWER's `spentAmount`, then from the History re-read) offers it. While any refusal notice stands, the cell draws only its act, not its sentence; a `spent-whole` cell under a notice draws nothing.
**Why:** Revised after `/code-review`. The first draft put the button in the notice with the step's X, which (a) kept a stale X after a re-read stated a higher spent figure, opening the form below its floor, and (b) still said the sentence twice for a wholly spent entry (step `none`). One button, fed by `offerFor`, always carries the freshest server figure.
**Revisit if:** The owner wants the button to stay pinned to the refusal's figure even after History says otherwise.

## Q: When the server refuses a delete with `DELETE_SPENT`, does the Reason typed for the delete carry into the change form?
**Decision taken:** Yes — `reduceToSpent(entry, reduce, reason)` pre-fills the change form's Reason with the refused delete's, editable there. From the offer cell (no delete was typed) the Reason starts empty.
**Why:** The accountant just wrote why this entry is wrong; retyping it is friction, and the box is in front of them to edit before sending.
**Revisit if:** Supervisors find delete-worded Reasons on reduce requests misleading — then pass `''` from the notice too.

## Q: A wholly spent entry (`spent-whole`): what is said?
**Decision taken:** The same sentence as a partly spent one ("The branch has spent X from this entry, so it cannot be deleted."), X the spent figure, and no Reduce button (HITL-343 / HITL-344: reducing to the amount it already holds changes nothing).
**Why:** One sentence for one fact; the absent button is the difference.
**Revisit if:** The owner wants "Reduce it to X" drawn anyway on a consumed entry (the open HITL-343 sign-off).

## Q: The delete body — `newAmount: null`, or no field?
**Decision taken:** No field. `deleteRequestBody` sends exactly `{ settlementEntryId, requestKind: "DELETE", reason }`.
**Why:** 2193 says "null or omitted"; omitted cannot trip `SettlementDeleteTakesNoFigures` on any server version (the same call HITL-343 made for `newBusinessDay`).
**Revisit if:** —

## Q: The delete form is open and an answer says the branch has spent from the entry. Does the form stay?
**Decision taken:** No. The delete form is drawn only while `offerFor`'s cell still offers `delete`; an answer (or re-read) that makes it `reduce` / `spent-whole` takes the form with it. A `DELETE_SPENT` refusal also closes it explicitly (step `reduce`).
**Why:** A delete form beside a sentence saying the entry cannot be deleted invites the same refusal.
**Revisit if:** —

## Q: What do the toasts say for a delete?
**Decision taken:** Raised: "Delete request raised for entry N." Applied at once (a supervisor's own): "Entry N is cancelled." An approved delete keeps 346's "The change request on entry N was approved and applied." — the pane itself redraws the entry as cancelled ("This entry was cancelled…"), which is what this ticket checks.
**Why:** W13 — a delete cancels the *entry*; a request is never "cancelled". 346's approve toast is the same for both kinds (HITL-346).
**Revisit if:** Copy review wants an approved delete to toast "Entry N is cancelled." (HITL-346's open item).
