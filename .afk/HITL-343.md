# HITL log — ticket 343 (the change-request pane, spec 342 W2–W8/W14)

## Q: What does a supervisor see in 343, before 348 adds "applies immediately — no approval step"?
**Decision taken:** The offer cell is rendered as decided: the button reads **Change now** (`data-mode="now"`) and opens the same change form, whose Submit reads "Change entry N now". An accepted raise answering `requestStatus: "APPLIED"` toasts "Entry N is changed." and redraws from the answer with no card; `"OPEN"` draws the card as for anyone. The form's *applies immediately* sentence is left to 348.
**Why:** The ticket says later slices RENDER 343's cells; hiding the supervisor's act, or labelling it "Request a change" when the server applies it at once, would both be wrong.
**Revisit if:** 348 lands late and the interim "Change now" without the warning sentence is judged unsafe.

## Q: An entry that is finished but still has an open request (should not happen after 2194) — which wins?
**Decision taken:** `finished` wins; nothing is offered.
**Why:** D2 — a finished entry is never changed; a direct act supersedes the request in the same transaction (2194).
**Revisit if:** The owner wants the card (with Reject) drawn on a finished entry for an orphaned OPEN request.

## Q: A wholly spent (`CONSUMED`) entry — what replaces delete?
**Decision taken:** A third `remove` cell, `{ kind: 'spent-whole', spent }`: no delete and **no** "Reduce it to X" (reducing to the spent figure would change nothing — the server's `NO_CHANGE`). 347 draws the sentence.
**Why:** W3's "reduce to the spent figure" is meaningless when spent equals the amount.
**Revisit if:** The owner wants "Reduce it to X" drawn anyway on a consumed entry.

## Q: A History read that answers without `spentAmount` (an older/malformed server, or `{}` from the earlier drives' catch-all)?
**Decision taken:** `offerFor` returns `unstated`; the pane says the change requests "could not be read in full" and offers no act. Never a floor of 0.
**Why:** A floor of 0 would offer a delete on an entry the branch may have spent from.
**Revisit if:** A real SIS.Api answers History without 2192's five figures for long enough to matter.

## Q: How is a 200 refusal of Raise worded before 344's refusal map lands?
**Decision taken:** One interim sentence naming the server's code: "The change request was not raised. The server answered {{code}}." (`data-code` on the notice). The form stays open.
**Why:** Ticket: "in this ticket a refused raise shows apiErrorMessage/message only"; the 200 refusal carries no message, only the code. 344 replaces it.
**Revisit if:** —

## Q: The correction pane's "Changing the amount is not offered at all" is now false. Change it?
**Decision taken:** Reworded to "Changing the amount is not offered at all **here**. … A wrong amount or Description is asked for as a change request, above; otherwise a wrong entry is cancelled by a supervisor and posted again." Both phrases the earlier drives assert are kept verbatim, so those drives pass unmodified.
**Why:** A pane saying "Request a change" directly above a sentence saying amendments do not exist contradicts itself.
**Revisit if:** The owner wants the sentence dropped entirely (that needs the two older drives edited).

## Q: Whose name and time does the card show between the raise and the History re-read?
**Decision taken:** The session's `displayName` (falls back to `userId`), and **no time** — the time is the server's and arrives with the re-read, which replaces the drawn card.
**Why:** The pure module has no clock; inventing a time would be a figure no server sent.
**Revisit if:** Auth/Me gains a display name that differs from `requestedByName`.

## Q: Withdraw parity (`userId` vs `requestedByStaffId`)?
**Decision taken:** Exact equality after trimming; an empty or unknown `userId` is never the requester. Live confirmation stays open on 345 (owner ruling 2026-10-01).
**Why:** Both are the server's UserId claim per W6.
**Revisit if:** 345's live check shows the two are different claims (e.g. login name vs staff number).

## Q: Does the Raise body carry `newBusinessDay: null` for a shortage/surplus?
**Decision taken:** No — the field is omitted; 349 sends it for a theft.
**Why:** 2195 400s `SettlementBusinessDayTheftOnly` on `newBusinessDay` for a shortage; omitting cannot trip it on any server version.
**Revisit if:** 349 needs a uniform body shape.

## Q: Should `invalidateSettlement` also drop the History cache?
**Decision taken:** No. The pane re-reads its own entry's History by the one key (`changeRequestHistoryKey`) after an act; `invalidateSettlement` is unchanged.
**Why:** 352 owns "after Cancel/Write off, the card shows superseded" and can add the prefix (`CHANGE_REQUEST_HISTORY_KEY`) there.
**Revisit if:** 352 lands without it.
