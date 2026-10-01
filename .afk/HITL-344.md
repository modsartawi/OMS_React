# HITL log — ticket 344 (the change-request refusal map, spec 342 W7)

## Q: The ticket gives one next step per code, but some codes mean different things on different doors. One step per code, or per door?
**Decision taken:** Per door. `changeRefusal(door, answer, message?)` takes `'raise' | 'approve' | 'reject' | 'withdraw'`. Most codes have the same step on every door. Four do not: `BELOW_SPENT` (raise → refill the floor; approve → reject), `DELETE_SPENT` (raise → "Reduce it to X"; approve → reject), `CHANGE_STALE` (approve → reject; a supervisor's own raise → redraw) and `THEFT_DAY_COLLECTED` (approve → reject; raise → stay). Each code has one sentence, worded so it is true on every door.
**Why:** The contracts give these codes a second meaning at approval: the request stays `OPEN` and the supervisor rejects it with a reason. That is the ticket's own row for `CHANGE_STALE` and `THEFT_DAY_COLLECTED`. If the map knew only one step per code, 346 would need a second table for Approve, and the wave forbids that.
**Revisit if:** 346 finds an approve-side step it needs that this map does not return.

## Q: An unknown 200 code "falls back to the server's message", but `api.post` hands back only `data`. Add a `postEnvelope` to `core/api.ts`?
**Decision taken:** No. `changeRefusal` takes an optional `message` and draws it only for an unknown code. A Raise refusal comes through `api.post`, so it has no message. An unknown 200 code is therefore named in a keyed sentence ("The server answered X."). An unknown **400** code does fall back to the envelope's message (`apiErrorMessage`).
**Why:** This wave extends only the settlement feature and its models. A 200 refusal's message is `''` or generic anyway, and the contract says to key UI copy off the code.
**Revisit if:** SIS.Api starts sending a meaningful `message` with a 200 refusal.

## Q: What does "BELOW_SPENT refills the floor" do to the amount the accountant typed?
**Decision taken:** The floor line ("Lowest allowed: X") is redrawn from the answer's `spentAmount` at once, through the W8 redraw. The typed amount is **kept**, so it is now flagged "cannot go below it" and Submit is held. The amount box is not overwritten with X.
**Why:** Overwriting would put a figure in the box the accountant did not choose. The form's own floor check already tells them what to do.
**Revisit if:** The owner wants the box pre-filled with the floor, as "Reduce it to X" does for a delete.

## Q: "ENTRY_NOT_OPEN → close the pane" — unmount the entry panel?
**Decision taken:** The change-request pane draws only the sentence ("Entry N no longer exists…"), with `data-offer="gone"` and nothing to press. It stays that way until another entry is selected (the pane is keyed by entry). The account is re-read as after every raise, so the entry drops off the list if the server says so. The rest of the panel is left alone.
**Why:** The other panes are not this map's to close, and a pane that disappeared with no word would read as a crash.
**Revisit if:** The owner wants the whole entry panel deselected.

## Q: "CHANGE_ALREADY_OPEN → open the waiting request" — the act answer carries only its id. How is it opened?
**Decision taken:** The form closes and the notice says a request is already waiting and is shown here. The History re-read (made after every raise) then draws that request's card. A `''` id gets its own sentence ("raised at the same moment") and the same re-read.
**Why:** The answer has no old/new figures, requester or reason, so the card can only be drawn from History. Making one up from the id would be drawing a figure no server sent.
**Revisit if:** The re-read's open request ever has a different id from the one named and the owner wants that called out.

## Q: Should a refused answer redraw the entry's figures (W8), or only an accepted one?
**Decision taken:** A refused one too. The act response always carries the entry's figures now. A `BELOW_SPENT` answer's `spentAmount` becomes the floor, and an `ENTRY_FINAL` answer's `entryStatus` draws the finished sentence before the re-read lands. A refusal says nothing about a waiting request, so History's `openRequest` still stands. An answer about another entry, or with `entryStatus: ''`, is ignored, as before.
**Why:** W8 says "every act response… the pane redraws from those". It is also the mechanism behind the ticket's "refill the floor from the answer's `spentAmount`".
**Revisit if:** —

## Q: `SettlementReasonTooLong` covers both the Reason and the Description. Which box gets it?
**Decision taken:** The Reason box when the body sent no `newDescription`. Otherwise the form, with a sentence naming both ("The Reason or the Description is over 200 characters as the server counts them").
**Why:** The code does not say which field it means, and blaming the wrong box sends the accountant to edit text that was fine.
**Revisit if:** 2191 splits the code in two.

## Q: Where does a day 400 (`SettlementTheftDayNotClosed`, etc.) go before 349 adds the day field?
**Decision taken:** `changeFieldError` maps it to `businessDay`. Until 349 draws that box, the change form shows it at the form's foot (`change-request-form-error`), together with the `form` codes.
**Why:** The map has to name the field now so that 349 only renders it. Today no raise sends a day, so this cannot happen yet.
**Revisit if:** —

## Q: `THEFT_DAY_COLLECTED` on a raise — keep the form or close it?
**Decision taken:** Keep it (`stay`).
**Why:** 2195 also sends this code when the *new* day is collected, and the accountant can pick another day. When the current day is the collected one, the sentence says the theft can no longer be corrected, and nothing is lost by leaving the form open.
**Revisit if:** 349 wants the form closed when the current day is collected (the code alone cannot tell the two cases apart).
