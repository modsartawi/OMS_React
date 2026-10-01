# HITL log — ticket 345 (the requester withdraws their own waiting request, spec 342 W6)

## Q: Does Withdraw ask for confirmation first, or act on one press?
**Decision taken:** One press. The button is held (`aria-disabled`, `aria-busy`) while the call runs. There is no confirm step and no reason box.
**Why:** The ticket and W6 describe Withdraw as sending `{ changeRequestId }` and nothing else, and 2194's body has no reason. Withdrawing loses nothing: the entry is never touched, and the accountant can raise the request again.
**Revisit if:** The owner wants a "Withdraw this request?" confirm, like the correction pane's two-step act.

## Q: After a `NOT_REQUESTER` refusal, should the card keep its Withdraw button?
**Decision taken:** No. This reverses my first draft after `/code-review` flagged it. The pane passes the refused request's id into `offerFor` as `read.notRequesterOf`. The offer module then stops offering Withdraw on that request, and the card still draws only the cell it is handed. The card stays, and the notice says the request is still waiting for a supervisor. A different request waiting later is judged afresh. The pane is keyed by entry, so a new entry starts clean.
**Why:** User story 12 says "so that I am not offered an act the server refuses". A button beside "Only the accountant who raised it can withdraw it" invites the same refusal on every press. Keeping the rule inside `offerFor` respects the one-function rule: no predicate beside it.
**Revisit if:** The live check finds that `userId` and `requestedByStaffId` can differ for the same person. Then the match in `offerFor` is wrong at its root and needs fixing there.

## Q: `session.userId` vs `requestedByStaffId` — are they the same claim? (owner ruling 2026-10-01: stays OPEN)
**Decision taken:** The match is stubbed. The drive's `Auth/Me` answers `userId: "msartawi"`, and the History row carries `requestedByStaffId: "msartawi"`. `offerFor` compares the trimmed strings exactly and never changes their case.
**Why:** No SIS.Api with the 2190 wave is reachable. W6 says both are the session's UserId claim on the server.
**Revisit if:** Once a live SIS.Api with the 2190 wave is up: raise a request, then check that `Auth/Me`'s `userId` equals the History row's `requestedByStaffId` for it. If the two differ even by case, `offerFor` hides Withdraw from the real requester.

## Q: Where does a 400 on Withdraw (`SettlementChangeBodyRequired`, `SettlementChangeRequestRequired`) go? There is no form.
**Decision taken:** It goes in the pane's notice line, worded by 344's `changeFieldError` key (`changeRequest.invalid.*`). A 400 the map does not know falls back to `apiErrorMessage`.
**Why:** The rules allow only one code table, and Withdraw has no box for an error to sit on.
**Revisit if:** —

## Q: What do the toast and the error lines say?
**Decision taken:** The toast reads "Your change request on entry N was withdrawn." The failure line reads "The change request could not be withdrawn.", and a 403 says the request "was not withdrawn". The word "cancelled" is never used (W13).
**Why:** These follow the wording of the existing `done.*` and `errors.*` keys.
**Revisit if:** Copy review wants "Change request withdrawn for entry N." to match `done.raised`.

## Q: Who knows that `NOT_REQUESTER` means "stop offering Withdraw" — the outcome reader, or the refusal map?
**Decision taken:** The refusal map. `changeRefusal` now gives `NOT_REQUESTER` its own step, `{ kind: 'not-requester' }`, in place of 344's `none`. It still offers nothing, and the table entry says the pane stops offering Withdraw on that request. The pane switches on the step, as Raise does: `close` sets the pane gone, `not-requester` feeds `notRequesterOf` to `offerFor`, and any other step relies on the re-read. `afterWithdraw` only says withdrawn or refused, the same shape as `afterRaise`.
**Why:** `/standards-review` found that `afterWithdraw` matched the code a second time, which made a small second code table. The wave rules allow only one, and that one is 344's.
**Revisit if:** 346 or 353 wants `NOT_REQUESTER` on another door to mean something else (today only Withdraw answers it).

## Q: 344's `NOT_REQUESTER` sentence said "Only the accountant who raised…". A supervisor can raise a request too.
**Decision taken:** It now reads "Only the person who raised this change request can withdraw it. It stays waiting for a supervisor to approve or reject."
**Why:** 2194 says a supervisor gets `NOT_REQUESTER` too, and since 345 a supervisor is offered Withdraw on their own request. "The accountant" would name the wrong person.
**Revisit if:** Copy review prefers naming the role.

## Q: The log above came from an earlier attempt whose code never reached the branch. Rebuild, or re-decide?
**Decision taken:** Rebuilt from scratch on 2026-10-01, following every decision above as written. The working tree held only this file. `git status` showed no code changes and there was no stash for 345.
**Why:** Those decisions had already been through `/code-review` and `/standards-review`. Deciding them again would have meant arguing the same points a second time.
**Revisit if:** The earlier attempt's code turns up somewhere. Compare it with this build before merging.

## Q: An accepted Withdraw answer that names a status other than `WITHDRAWN`. Is it withdrawn?
**Decision taken:** No, and not "refused" either. My first draft called it a refusal with no code, and the spec review pointed out that this claims a refusal the server never made. `afterWithdraw` now returns `unconfirmed`. The pane says "The server accepted the withdraw but did not confirm the request was withdrawn", and the re-read draws whatever is true.
**Why:** 2194 says an accepted withdraw answers `"WITHDRAWN"`. A toast saying "was withdrawn" over an answer that says `OPEN` would claim something the server did not say.
**Revisit if:** SIS.Api ever answers an accepted withdraw with another status on purpose.

## Q: `CHANGE_NOT_OPEN.WITHDRAWN` said "withdrawn by the accountant who raised it".
**Decision taken:** It now reads "This change request was already withdrawn by the person who raised it." This is the same reason `NOT_REQUESTER` was reworded: a supervisor can raise a request, and since 345 can withdraw it.
**Why:** W13 and 2194 both allow a supervisor to be the requester.
**Revisit if:** Copy review prefers naming the role.

## Q: After a refused withdraw (`CHANGE_NOT_OPEN`), does the card go at once, or only after the re-read?
**Decision taken:** Only after the re-read. A refusal leaves `request` unset in what the pane draws, so History's word stands until History is re-read. This is how Raise's refusals behave (343/344).
**Why:** The pane only knows a request is gone from what the server sends back. Hiding the card because of the code would make the component a second code table. Reading `requestStatus` would add a rule beside `afterWithdraw`. The re-read is immediate anyway, because `invalidateSettlement` runs on every answer.
**Revisit if:** Someone sees a Withdraw button sitting beside a "superseded" sentence for long enough to press it. A second press is harmless: it answers `CHANGE_NOT_OPEN` again.
