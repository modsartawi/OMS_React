# HITL log — ticket 346 (a supervisor approves or rejects a waiting request, spec 342 W6/W8)

## Q: Does Approve ask for confirmation first, or act on one press?
**Decision taken:** One press. All of the card's buttons are held (`aria-disabled`, `aria-busy`) while any act on it runs. The card itself is the review: old → new, who asked, the Reason, and what the branch has spent today, all drawn directly above the button.
**Why:** The ticket says "Approve sends `{ changeRequestId }`" and nothing about a confirm. 345 made the same call for Withdraw. Reject already has two steps because it needs a Reason.
**Revisit if:** The owner wants an "Approve and apply this change?" step, since an approve moves money and Withdraw does not.

## Q: After a refused approve (`BELOW_SPENT`, `CHANGE_STALE`, `THEFT_DAY_COLLECTED`), does Approve stay drawn?
**Decision taken:** Yes. The card keeps Approve and Reject. The notice gives 344's sentence plus the `reject` step's line: "It is still waiting. Reject it with a Reason; a fresh request can then be raised against the entry as it stands now."
**Why:** The ticket asks for the card to be "left in place, still `OPEN`". Unlike `NOT_REQUESTER`, these refusals are not permanent for the request: a till reversal can lift spending back under the new amount. The server is still the guard.
**Revisit if:** Supervisors keep pressing Approve on a `CHANGE_STALE` request. That refusal is permanent in practice, so `offerFor` could stop offering Approve on it, the same way it handles `notRequesterOf`.

## Q: An approve refused `ENTRY_FINAL` — keep the card (the ticket's list) or draw the finished sentence (W7 "redraw")?
**Decision taken:** Draw the finished sentence from the answer's `entryStatus`. `finished` wins over a waiting request, which is HITL-343's ruling, kept here. The refusal sentence shows above it.
**Why:** D2 says a finished entry is never changed. On a 2194+ server, a direct act supersedes the request in the same transaction, so a live request cannot sit on a finished entry. The re-read then shows no card either (`CHANGE_NOT_OPEN`/`SUPERSEDED`). The ticket lists `ENTRY_FINAL` among refusals that keep the card, which contradicts W7's step and HITL-343. The spec reviewer flagged the conflict.
**Revisit if:** The owner wants Reject drawn on an orphaned `OPEN` request on a finished entry. That is a change to `offerFor`, the same sign-off HITL-343 asks for.

## Q: `ENTRY_NOT_OPEN` on Approve: "no longer exists, close the pane"?
**Decision taken:** Only when the answer names no entry (`settlementEntryId: ''`). When the answer still names the entry, the refusal map (`changeRefusal('approve', …)`) says it in the generic `tracer` sentence with the code, and the step is `reread`. The card stays. The spec's W7 row is amended to say this.
**Why:** BackOffice `SettlementChangeRequestStore.RefusedAsync` answers `ENTRY_NOT_OPEN` as its fallback when the entry exists and nothing it can name stopped the request, and the request stays `OPEN`. Closing the pane would hide a waiting request behind a false sentence. REVIEW-344 #4 asked 346 to confirm this against BackOffice.
**Revisit if:** BackOffice gives that fallback its own code.

## Q: Where is a refused approve said — inside the card or above it?
**Decision taken:** In the pane's notice line, directly above the card. This is the same place Raise's and Withdraw's refusals go.
**Why:** It is one notice line for the pane, and the earlier drives' `change-request-notice` addressing stays the same.
**Revisit if:** Copy review wants the refusal inside the card's border.

## Q: Is "what the branch has spent today" drawn for an accountant too?
**Decision taken:** No. It is drawn only in the supervisor's `decide` block (story 16). When no server has stated a spent figure, the block says so (`spentUnstated`) and offers Approve anyway, because the server re-checks.
**Why:** The ticket gives it to the supervisor. An accountant's card is unchanged from 345.
**Revisit if:** Accountants want the same line on their card.

## Q: Does a Reason typed in the Reject box survive Back, or a different request arriving?
**Decision taken:** Back throws it away. The box belongs to one request (`RejectDraft.requestId`): a draft for R-151 is never drawn on R-152's card, even on the same entry. Opening Reject after a refused approve keeps the refusal notice on screen.
**Why:** `/code-review` found that a per-entry draft let one click reject a later request with an earlier request's Reason, and that clearing the notice on "Reject" erased the figure the Reason has to explain.
**Revisit if:** —

## Q: What do the toasts and failure lines say?
**Decision taken:** "The change request on entry N was approved and applied." and "The change request on entry N was rejected. The entry is unchanged." A bare 403 reads: "You no longer hold settlement supervision, so this change request was not decided. Ask an administrator if you should." This follows `approval.errors.forbidden`'s wording. An accepted answer with an unexpected status is "unconfirmed", as `afterWithdraw` (345) treats it.
**Why:** W13: a request is rejected, never "cancelled". The toast is the same whether the request was a change or a delete, because "change request" is the noun for both.
**Revisit if:** Copy review wants an approved delete to toast "Entry N is cancelled" instead.
