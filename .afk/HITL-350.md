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
**Decision taken:** The tag is still drawn, with the date and "amount not changed" in place of
"was X" (`changedTag` → `earlierAmount: null`).
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
