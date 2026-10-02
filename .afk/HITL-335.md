# HITL — ticket 335 (Cash Collections opens with finance's nine columns and a Type)

## Q: BackOffice 2152 had no `## Web contract` heading when this session started. Is 335 startable?
**Decision taken:** Built against BackOffice 2151's contract, which was written and committed on branch `spec2149` (worktree `C:\Work\DMSCO\BackOffice-2149`, commit e3ad98072) but is NOT on the `pricing2` checkout at `C:\Work\DMSCO\BackOffice`. 2152 was being built in that worktree while this session ran. The commit of 335 was held until 2152's note could be read; see the last entry of this file for what was found.
**Why:** 2151's contract declares every field 335 reads, the theft fields included, and says of 2152: "Only values … No field is added or renamed." Nothing in the stub was guessed.
**Revisit if:** 2152's note, once written, names a field or a label 2151's does not.

## Q: Finance's "Collector" column — the collector's name or id?
**Decision taken:** The id (`collectorOperatorId`), headed "Collector". The name moves behind More columns as "Collector Name". Until now the name was the default column, headed "Collector", and the id was "Collector Id" in the tail.
**Why:** 2151's contract maps the sheet's Collector to `collectorOperatorId` ("the collector's id"), and finance's sheet carries the id.
**Revisit if:** accountants want to read a name on the landing grid. It is a one-line swap in `DEFAULT_FIELDS`, plus the two labels.

## Q: "Collection date" — the contract says "Show the date". The column showed date and time.
**Decision taken:** Left as it was: `yyyy-MM-dd HH:mm`.
**Why:** The ticket says every column the screen has today stays and nothing is deleted. The collection time is on no other column, so a date-only cell would remove it from the screen and the export.
**Revisit if:** finance wants the bare date to match the sheet cell for cell. Then the instant needs a column of its own in the tail.

## Q: The store code column was headed "Store". Finance's sheet says "Store code".
**Decision taken:** Renamed to "Store Code" (the header Collection Attempts already uses).
**Why:** "Same columns, same order, same words" is the ticket's Done-when.
**Revisit if:** a saved export template keys on the old "Store" header.

## Q: The ticket says the wire model declares the already-sent fields. Do they become columns?
**Decision taken:** No. All 26 contract fields are declared on `CollectionInquiryRow`. The four finance columns are on the grid. The other 22 are listed in `NON_COLUMN_FIELDS` with their reason: the four booleans are the parts of the Type label; `cashSales`, `settlement`, `theftAmount` and `settlementDescription` are what Amount, Surplus and Description are built from; the rest (receipt kind, status, Z number, amendment count, off-system fields, the shift pair) had no column before and the ticket asks for none.
**Why:** The ticket asks for finance's nine, the profit center, and today's columns behind the toggle. Seventeen new tail columns would each need a header nobody has ruled on.
**Revisit if:** the owner wants Cash Sales, Settlement, Status or the off-system reason behind More columns. Each is one entry in `MORE_FIELDS` and one label.

## Q: Where does the Slips column sit now that Card Total is behind More columns?
**Decision taken:** Unchanged rule: right after Card Total. With the tail folded, Card Total is not drawn, so Slips is the last column, after the profit center. With the tail open it follows Card Total as before.
**Why:** The ticket says the slip-count column keeps working and the default set is finance's nine then the profit center. Slips was not moved into the nine.
**Revisit if:** the slip count should stay beside a money column on the landing grid.

## Q: What order do the six former default columns take in the tail?
**Decision taken:** They lead the tail in the order they had on the landing grid (receipt number, store name, collector name, variance, card total, reason), ahead of the previous tail.
**Why:** They were the columns people looked at; the first scroll after "More columns" finds them.
**Revisit if:** never likely.

## Q: `tools/collection-drive.mjs` ends 258/260 and `tools/profit-center-drive.mjs` crashes. Are those this ticket's?
**Decision taken:** Not fixed. The two collection-drive failures are the ACR landing-date checks ticket 336 already recorded (commit b124dfe changed the ACR landing and not the drive). The profit-center drive still reads a CSV export, which ticket 336 replaced with a workbook; it crashed the same way with this slice stashed. Only the checks this ticket broke were updated in both files.
**Why:** Neither is this ticket's behaviour.
**Revisit if:** someone wants the drives green as a wave close-out.

## Note for BackOffice (not edited from here)
`C:\Work\DMSCO\BackOffice\.issues\2151-*.md` on branch `pricing2` has no `## Web contract`; the heading exists only on `spec2149`. Anyone reading the contract from the main checkout before the merge will think 2151 has not landed.

## Outcome: BackOffice 2152's Web contract, read after it was committed
**Found:** 2152 committed its `## Web contract` (a0989fe51, branch `spec2149`, `status: done`). It adds no field and renames none, and adds no route, grant or query field. The fields and label values are exactly 2151's. The stub needed no change of shape.
**Reconciled (values and wording only):**
- `description` on a day with a surplus AND an approved theft is the two descriptions joined by the server as `A | B`. The drive's `Regular+Surplus+Stolen` row now sends the joined text, and a vitest case shows it whole. The model's doc says so. The web never splits it.
- The drive's theft description is now 2152's own Arabic sample text, copied, in place of an English placeholder. A vitest case restates 2152's sample row (3500 / -3000 / 500, `hasSurplus: false`) and asserts the five cells.
- The model's docs now record that `hasSurplus` stays `false` on a `Regular+Stolen` row, and that only the day's last shift row carries the theft.
**Why:** 2152's "Known limits" are server behaviour. The grid shows the rows as sent, so nothing in the web depends on them.
**Revisit if:** finance reads a multi-shift day and expects the theft on every one of its rows. That is a BackOffice 2152 question, not a web one.

## Review round (code-review, standards-review): what was kept for the owner
- **Slips on the landing grid.** The spec reviewer read "finance's nine … then the profit center" as the whole landing grid. Under that reading, a session holding `CASH_CLOSE` should not see an eleventh column (Slips). **Kept:** Slips is still drawn after the profit center. Folding it would put the slip drawer, which opens from that column (tickets 320–323), behind More columns. That breaks shipped behaviour this ticket was told to keep working. **Owner call:** move it behind the toggle beside Card Total, or leave it.
- **Collection date keeps its time.** The spec reviewer flagged this against 2151's "Show the date". It is the decision above, still open for sign-off.
- **The 22 declared fields stay non-columns.** The standards reviewer read the file's "nothing is dropped" doctrine as putting the audit fields (Z number, amendment count, off-system reason) in the tail. **Kept out.** `NON_COLUMN_FIELDS` now gives a reason for each group rather than one line for all of them. Adding any of them is one entry in `MORE_FIELDS` plus one label.
