# HITL — ticket 350 (requests in the audit column, the "Changed" tag)

## Q: Where is "the entry panel's header" that shows **Changed**?
**Decision taken:** In the change-request pane's header (`EntryChangeRequest`, beside "Entry N"), as a
pill: `Changed 2026-08-14 · was 350.00`.
**Why:** The branch account has no single entry-panel header — each pane has its own. The
change-request pane is the one drawn for every entry (pending or not), it owns the History read
the tag comes from, and it sits directly under the grid for every non-pending entry.
**Revisit if:** The owner wants the tag in the grid row (the till puts it on the Description line)
or on every pane's header.

## Q: What does the tag say when no applied change moved the amount (Description- or day-only)?
**Decision taken:** The tag is still drawn, with the date and "amount not changed: X" (X the
entry's amount now) in place of "was X" (`changedTag` → `earlierAmount: null`).
**Why:** That is the till's rule as built (2197's comment: "Amount not changed: X" when only the
description or a theft's day moved), and web and till must agree.
**Revisit if:** The owner wants no tag at all for a change that left the amount alone.

## Q: Which request facts carry a Reason?
**Decision taken:** The raise carries the request's Reason; a rejection carries the rejection's
reason; a supervisor's own (one applied fact) carries the request's Reason. An approval, a
withdrawal and a supersede carry none — the raise of the same request above them says why.
Old → new is drawn on the raise and on the application only.
**Why:** Repeating the same Reason on two rows of one request doubles the column without adding
a fact; a rejection's reason is its own fact.
**Revisit if:** The owner reads "each shows the request's Reason" literally and wants it on every
request row.

## Q: The tag's date — a day or a date-time?
**Decision taken:** The day only (`formatDay`), as the till shows it; the full stamp is in the
audit column's applied fact and on `data-at`.
**Why:** The till's tag reads `Changed 2026-10-01`; same entry, same words.
**Revisit if:** Two changes on one day need telling apart from the header.

## Q: The Proof names `auditFacts`; the module's function is `auditColumn`.
**Decision taken:** Extended `auditColumn(row, requests?)` rather than adding a second function.
**Why:** One column, one comparator — a second entry point would be a second place the merge
could be done differently. Without `requests` the column is byte-for-byte what it was.
**Revisit if:** Never, unless a caller needs request facts on their own.

## Q: Copy for the request facts.
**Decision taken:** "Change requested" / "Delete requested"; "Change request approved — the entry
was changed" / "Delete request approved — the entry was cancelled"; "Changed by a supervisor at
once — no approval step" (own); "… rejected" / "… withdrawn" / "… superseded". Never "cancelled"
for a request (W13).
**Why:** W13's nouns and verbs; the own wording echoes 348's "applies immediately — no approval step".
**Revisit if:** The owner wants different words.

## Q: Once a change has applied, what does the "Posted" fact of the audit column say?
**Decision taken:** The figures it was POSTED at — the earliest applied change's `oldAmount` and
`oldDescription` (the server's record of the entry when that request was raised). Without History
(404, loading) it falls back to the entry's own fields, as before 350.
**Why:** /code-review: "Posted 320" above "Change 350 → 320" contradicts the column it heads. Nothing
but an applied change moves an amount or a Description, so before the first one the entry stood as
posted. This changes a 272 fact, which the ticket does not name (standards-review flagged it as scope).
**Revisit if:** The server ever moves an entry's amount or Description outside a change request, or
the owner prefers the posting row to show today's figures.

## Q: Two facts in the same second — which first?
**Decision taken:** A raise and an applied request read before the entry's own fact of that second
(an approved delete IS the cancel); a raise before its own decision; a supersede after the direct act
that ended it. A raise and a till consumption in the same second keep a fixed order, not a known one.
**Why:** Stamps are to the second; the order is stable, and the cause reads before its effect.
**Revisit if:** The server's stamps gain sub-second precision on every row (then time alone decides).
