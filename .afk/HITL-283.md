# HITL — ticket 283 (the settlement views answer to paths)

Decisions taken unattended, 2026-08-15. Each is the most conservative option consistent with the
ticket, spec 282 D3/D4 and wayfinder answer 279.

## Q: What does `/collection/settlement/upload` draw when no `?batch=` names a batch?

**Decision taken:** 273's `BulkUploadDialog`, mounted `open`, with dismissal navigating back to the
Overview at the reader's scope. The door's *Bulk upload* button stops holding `useState` and
navigates to the path instead; `?batch=` on the same path still draws `BatchWithdraw`.

**Why:** The ticket gives `/upload` the row *"Bulk upload, and a batch's withdrawal"* and 284 points a
nav leaf at it while explicitly allowing itself only three changes — so the upload has to be a screen
by the end of *this* slice, and the only alternative (a page drawn around the dialog) would mint copy
in a slice whose Boundaries say **no new i18n keys**. Making the button navigate rather than leaving
two ways to open the same thing is what keeps one spelling.

**Revisit if:** 285/288 want the upload to sit under the lane's furniture, or a reader finds a modal
over an empty page jarring enough to be worth a real page — at which point it is a design ticket with
copy in it, not a routing slice.

## Q: Opening the upload from the door now drops the door's `?q=`. Keep it?

**Decision taken:** no — the search is dropped, like every other link on this screen, and the
`KEPT` list stays `[SCOPE_PARAM]`.

**Why:** It is a real change (the dialog was component state, so a search survived behind it), but
the alternative is either a keep-list the ticket's Boundaries freeze, or one address that carries the
search while the four beside it do not. `addresses.ts`'s own rule already covers this case in words:
*a search that took you somewhere has done its job*, and it is the same thing that happens when the
reader opens a branch account and comes back.

**Revisit if:** the upload ever becomes something a reader dips into mid-search often enough to
notice — then `?q=` is a candidate for `KEPT`, argued once for all five addresses rather than
smuggled into one.

## Q: Where does a hand-edited `?view=batch` with no batch land?

**Decision taken:** on the door — no redirect at all. Only `?view=batch` *with* a batch id goes to
`/upload`. (Reversed during review; the first cut sent the bare half-address to `/upload`.)

**Why:** It is where that address landed before 283 (`readBatchView` required both halves), and the
alternative hands somebody who pasted half a *withdrawal* link a form for **posting** a month of
entries — the opposite act, on the one screen in this feature that commits money in bulk. The
both-halves rule is still dead as grammar: a live `?batch=` on `/upload` needs nothing vouching for
it, because the path says which screen reads it.

**Revisit if:** the upload ever stops being the same screen as the withdrawal.

## Q: `scopeSearch` returns *the same view at another scope* — how does it name a path?

**Decision taken:** it takes the current `pathname` as a third argument rather than assuming the
Overview or returning a relative `?search`.

**Why:** Every other builder knows which screen it is naming; this one's answer is *where you already
are*. A relative address would have been the only builder whose correctness depended on the caller's
location, which is exactly the class of bug 283 is removing.

**Revisit if:** a screen ever wants a scope control that also changes screen — it would want its own
builder, not an argument on this one.

## Q: What does the `/open` shell render, with no keys allowed?

**Decision taken:** an empty `<div data-region="settlement-open" />`. No copy, no placeholder
sentence.

**Why:** The ticket calls it an *empty shell in this slice*, and 285 owns every string this screen
will hold. A placeholder would be a user-visible literal or a key minted ahead of the sentence it
belongs to. The region is named so the drive can prove *this* screen rendered rather than the
Overview.

**Revisit if:** 285 slips far enough behind 284 that the nav advertises a visibly blank screen to a
real accountant — then it wants a one-key *coming soon*, which is a decision with an owner in it.
