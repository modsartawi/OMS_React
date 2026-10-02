# HITL log — ticket 352 (a direct act warns that a waiting request will be superseded)

## Q: How long does the pane show a superseded request — only right after the direct act, or until something newer happens?
**Decision taken:** Whenever History's LATEST request on the entry (newest by `requestedAt`, then the ULID) is `SUPERSEDED` and nothing waits (`supersededRequest`). It is drawn above the pane's own content in the finished, ask and read-only states, and goes when a newer request is raised or decided another way.
**Why:** It is derived from the server's read alone, so it survives a reload and a second tab, and needs no "an act just happened" state shared between the correction/approval panes and the change-request pane.
**Revisit if:** The owner wants it only in the moment after the act (then 350's audit column alone carries it), or the card is judged noise on an entry superseded long ago.

## Q: The confirm sentence's wording and placement.
**Decision taken:** The ticket's words verbatim: "The waiting change request will be closed as superseded." / "Any change request waiting on these entries will be closed as superseded." (`settlement:changeRequest.supersede.*`). Correction pane: above the Reason box of the Cancel / Write off confirm step. Approval dialog: under the "what this act does" sentence. Bulk Cancel: under "not retro-voided", supervisor only. One shared `SupersedeNote` with the change-waiting mark's glyph (FilePenLine).
**Why:** Copy stays the spec's (W12); the sentence sits where the act's consequences are already listed.
**Revisit if:** Owner copy differs, or the sentence should be an attention-tone notice rather than a plain line.

## Q: The superseded card's copy.
**Decision taken:** Title "The change request on entry {{number}} was superseded." (a delete: "The request to delete entry {{number}} was superseded."), then "Closed on {{at}} when {{by}} acted on the entry directly." (`decidedByName`, `decidedAt` — 2194's SUPERSEDED row), then old → new, "Asked by …" and the Reason, as the waiting card draws them. No button.
**Why:** W13 — a request is superseded, never "cancelled"; 2194's table says `decidedBy…` is the supervisor whose direct act ended it.
**Revisit if:** The owner wants the direct act named (Cancel / Write off / Approve / Reject) — History does not say which, so that needs the entry's own facts.

## Q: Bulk Cancel re-reads which History reads?
**Decision taken:** Every entry's (`CHANGE_REQUEST_HISTORY_KEY` prefix), on any answered bulk cancel.
**Why:** The batch's entries are not known on the web; a cached History of a withdrawn entry would keep drawing a superseded request as waiting.
**Revisit if:** The bulk answer's rows are used to invalidate per entry (they carry `settlementEntryId`) — a narrower re-read, same result.

## Q: Does the entry panel's sentence also follow the change-request pane's own just-raised answer (before History is re-read)?
**Decision taken:** No — History only. A raise re-reads History at once (343's W8), so the window is one round trip.
**Why:** The pane's `answered` state is local to `EntryChangeRequest`; sharing it would couple three panes for a sub-second gap, and the sentence guards nothing.
**Revisit if:** A drive or the owner finds a supervisor confirming a direct act inside that window.

## Q: Where does `supersedeWarning` live, given "later slices render the offer module's cells and add no predicates beside it"?
**Decision taken:** In `change-request.ts`, as its own section (W12), not inside `offerFor`. It decides no affordance of the change-request pane — it only words another pane's confirm step, from History's `openRequest` or the row's `openChangeRequestId` (reusing 351's `hasChangeWaiting`).
**Why:** The ticket names a pure `supersedeWarning`; W3's table has no direct-act column.
**Revisit if:** The reviewer reads W3 as covering the direct acts.

## Q: (code-review) The batch sentence said "these entries", but a Bulk Cancel refuses partly consumed and pending rows, whose requests stay OPEN.
**Decision taken:** Reworded from the ticket's verbatim copy to "Any change request waiting on an entry this withdraws will be closed as superseded."
**Why:** 2194 — only an ACCEPTED direct act supersedes; the verbatim copy promised a supersede on rows the act refuses, inviting a supervisor not to decide those requests.
**Revisit if:** The owner prefers the ticket's exact words.

## Q: (code-review) What does the entry panel's confirm step say while History has not answered, or failed?
**Decision taken:** A third sentence, `unknown`: "Any change request waiting on this entry will be closed as superseded." — for History in flight or failed for any reason but a 404. A 404 (no wave on the server) is a true *none*. `supersedeWarning` takes the query result itself, so no caller decides "unread" its own way.
**Why:** Silence there read exactly like "nothing waits" while a request might.
**Revisit if:** The owner wants silence until History answers.

## Q: (code-review) The lane's sentence was captured at the press; the entry panel's is read live.
**Decision taken:** Both live now: the lane reads the row's `openChangeRequestId` from the queue's CURRENT answer; a row gone from the queue was decided elsewhere (the act will be refused) and draws none.
**Why:** One dialog, one behaviour wherever it was opened.
**Revisit if:** —
