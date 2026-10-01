# HITL log — ticket 351 (change waiting mark)

## Q: Where does the "change waiting" mark sit on a row — its own column, or beside the entry number?
**Decision taken:** An icon (lucide `FilePenLine`, `text-primary`) inside the entry-number cell, after the number (`EntryNumberCell.tsx`), on the Ledger and the three entry tabs (owing/owed lanes, Awaiting approval, Theft). The cell's value stays `entryNumber`, so sort and the number filter are unchanged; the entry-number columns widen 110→124 (Ledger) and 96→112 (lanes).
**Why:** A dedicated column would be blank on almost every row; the number is the handle the request is about. Adds no column, so no saved layout or earlier drive's column assertions move.
**Revisit if:** The owner wants a filterable/sortable "Change waiting" column, or a different glyph or colour.

## Q: What does the mark say?
**Decision taken:** aria-label "Change waiting"; tooltip "A change request is waiting on this entry. Open the entry to see what is asked." (`settlement:changeRequest.mark.*`). The mark is not a button.
**Why:** W13's noun is "Change request". The row's own click already opens the entry, where 343's pane says what is asked.
**Revisit if:** Owner copy differs, or the mark should open the request directly.

## Q: Does the Cash-waiting tab show the mark?
**Decision taken:** No. Its rows are receipts (`Settlement/Uncollected`), which carry no `openChangeRequestId`.
**Why:** W10 names the `Settlement/Ledger` grids only. No field means no mark, and 351 adds no door.
**Revisit if:** BackOffice adds the field to `Settlement/Uncollected`.
