# HITL — ticket 287 (chase notes), spec 282

Decisions taken unattended while building *Chasing a branch is recorded from the row*.

## Q: contract 278 answers `{ accepted, chase }` — where does a refusal's wording come from?

**Decision taken:** `SettlementChaseResult` carries an **optional** `refusalReason`, read when the
door sends one and falling back to `open.chase.refused` in the namespace when it does not.

**Why:** the ticket's own Proof line asks that "a refusal (`accepted:false`) **surfaces its
message**", and every sibling door on this screen (cancel, repair, bulk commit) carries a
`refusalReason`; but 278's contract does not name one and 274's finding is that a type whose door
never agreed to it is a claim about the server. Optional + a client sentence underneath transcribes
the contract without inventing a required field — the same asymmetry `SettlementCloseOutResult`
already carries.

**Revisit if:** BackOffice builds §7 and the door either sends the field (make it required) or
refuses with an envelope `message` instead (read that instead).

## Q: the chase note is `varchar(400)`; `ReasonField` hard-codes `REASON_MAX` (200)

**Decision taken:** `ReasonField` gained an optional `maxLength` prop defaulting to `REASON_MAX`, and
`CHASE_NOTE_MAX = 400` lives in `open-lane.ts` beside the `ChaseCell`.

**Why:** the shared control's own docblock argues the limit must not differ *between the three reason
boxes* — an accountant should not learn two limits for the same act. A chase note is not a reason: a
different table, a different column, its own server limit, and over-length is one of the door's four
refusals. Truncating at 200 would be a client rule the server never made, cutting a memo in half for
no reason the reader could see.

**Revisit if:** a fourth caller wants a third limit — at that point the limit belongs on the caller's
side of the seam entirely, not as a default.

## Q: how does the row change after an accepted note — refetch or write the cache?

**Decision taken:** `queryClient.setQueryData` on **both** lane keys, through the pure `applyChase`,
from the **server's** returned `chase`.

**Why:** the ticket's premise is that a session of twenty calls must not become twenty navigations;
invalidating would re-read 2,000 entries after each one, which is the same cost moved onto the
network. What is written is what a refetch would have returned — the server's stamp, the server's
name, laid onto **every row of that branch**, because that is what the door's own
newest-note-per-branch projection does. Both keys, because one call can be about a branch that has an
open entry *and* an uncollected receipt.

**Revisit if:** the door ever answers something a client cannot reconstruct (e.g. a per-row
projection that is not "newest per branch") — then invalidate and pay the read.

## Q: is *Never chased* an address (`?chased=never`) or component state?

**Decision taken:** component state, beside *Mine only*.

**Why:** 285 settled the same question for *Mine only* on spec 282 story 39, which asks for the
**scope** and the **tab** to survive a walk through a branch account and names nothing else. A chip
narrows what is on screen; it does not describe what the screen is looking at. Following the
neighbour also keeps `addresses.ts`'s `KEPT` list a keep-list.

**Revisit if:** an accountant wants to send a colleague "the never-chased list" as a link.

## Q: where does the *Last chased* column sit in the row?

**Decision taken:** last, after *Served by* — the prototype's own order.

**Why:** the column order is the spoken sentence (D11), and the sentence ends at *"served by Ayed"*.
The note is what the accountant **writes**, not what they read out, so it belongs beside the phone
rather than inside the sentence.

**Revisit if:** the row is ever read aloud including the last note ("we spoke Tuesday, they said…"),
which would make it part of the sentence rather than an annotation on it.

## Q: the prototype stacks *Record a chase* UNDER the note; the build puts it inline

**Decision taken:** inline at the end of the cell, right-aligned, with the note stacked beside it.

**Why:** the prototype's chase cell is three lines tall (date · note / the caller's name / the
button) and its rows are drawn at that height. This lane's row height is **44px and two lines**, and
that is 285's own shipped decision — the answer to *"a chase list is read one row at a time while
talking"* (D11). Stacking the button would either overflow the row or force every row on all three
tabs taller for a control most rows are not about to use. The arrangement — which column, in what
order, saying what — is the prototype's and is unchanged; only the cell's internal stacking differs.

**Revisit if:** the owner reads the prototype's row height as part of the approved arrangement, in
which case the lane's rows grow and 285's `LANE_ROW_HEIGHT` moves with them.

## Q: should pressing *Never chased* be cleared when the reader moves to a tab whose door is silent?

**Decision taken:** no — the chip keeps its state, is hidden, and the projection **ignores** it.

**Why:** it is the same answer 286's `/code-review` settled for *Mine only* one field over: a filter
over a fact the answer does not carry is not a filter, so `arrange` ignores it rather than emptying
the tab. Clearing it instead would mean walking to Cash waiting and back silently undoing a
narrowing the reader chose. (The prototype clears it, but there the toggle is a **simulation**
control for the door's existence, not a reader's filter.)

**Revisit if:** a reader is surprised to find the chip pre-pressed on returning to a tab that offers
it — which is a real, if small, cost of this choice.

## Found by driving, not by reasoning — recorded so it is not re-litigated

`e.stopPropagation()` inside the *Record a chase* button does **not** stop the row's navigation. AG
Grid listens on the row element, which is nearer the click target than React's delegated root
listener, so the account had already been navigated to by the time the button's own handler ran — the
first drive of the button landed on `/collection/settlement?store=…`. The exemption is made where the
row click is decided (`onRowClicked` skips a target inside `[data-row-action]`), because the row is
what owns that click. Any future in-row action needs the same attribute.
