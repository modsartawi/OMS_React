# HITL-314 — decisions taken AFK

Contract read: BackOffice **1990**. It is `status: done` and has a `## Web contract` section. I cross-checked it against
the committed code (`49c977051`, merged in `ae11fac70`): `CollectionInquiryModel`, `CollectionAttemptInquiryModel`,
`AcrFormDocument.AcrFormDocumentRow.StoreText`, `CollectionReceiptDocument.StoreText`, `ProfitCenterFormat`, and
`CollectionWebEndpoints` (the grids delegate to the shipped handlers, which serialize the model; `StoreText` is a
get-only property and is emitted like the rest).

**The contract and the code agree field for field.** The web adds `profitCenter` + `storeText` to the Collections and
Attempts rows, and `storeText` to the ACR-form row and the receipt page. Nothing else was added.

## Q: The brief says BackOffice branch `main`, but that branch does not exist
**Decision taken:** I read BackOffice on `pricing2`, the branch checked out there. The spec1976 merge `ae11fac70` and
1990's commit `49c977051` are both on it (`git branch --contains`). `master` exists but does not carry the merge.
**Why:** It is the only branch holding the wave's merged contract and code, and I only read from it.
**Revisit if:** the wave is meant to track a different BackOffice branch.

## Q: "A profit center column in the ACRs grid". The ACR row carries no store
**Decision taken:** The ACRs grid (`CollectionWeb/Acrs`) gets no new column. The ACR's per-row data is the
Collections door under `?acr=` (the shipped drill-down), and it now shows the column. The ACR form's rows print
`storeText`.
**Why:** 1990's contract says so directly: "an ACR spans a round and carries no store, so the `CollectionWeb/Acrs`
row is unchanged". The drive proves the drill-down shows the column.
**Revisit if:** the ACR aggregate ever gains a store.

## Q: Should the column replace the store code column, as Ready's did, or sit beside it?
**Decision taken:** Beside it. **Profit Center (Store)** (`storeText`) is a new default column right after Store
(Collections) and Store Code (Attempts). The store code column, its floating filter and its place in the CSV are
unchanged. The raw `profitCenter` goes to the More-columns tail.
**Why:** The ticket asks for "a profit center column", which is an addition. This is also the option that changes
nothing already shipped: the Store filter the collection drive uses and the CSV's leading columns stay as they were.
Ready (317) could let `storeText` stand in for the code because it was a new screen.
**Revisit if:** finance finds the two columns redundant once every store has a profit center. Then drop `storeId` /
`storeCode` into the tail, as Ready does. It is a one-line move in `DEFAULT_FIELDS` / `MORE_FIELDS`.

## Q: The column label
**Decision taken:** "Profit Center (Store)" for `storeText` and "Profit Center" for the raw value, the same en strings
Ready uses (`ready.columns.storeText` / `.profitCenter`).
**Why:** One label for the same field across the four sibling grids. This settles HITL-317's "revisit if 314 settles a
different header label".
**Revisit if:** finance names it otherwise. Change it in all three namespaces' keys together.

## Q: The contract says `profitCenter` is the raw value, to "sort and export by". Does the storeText column sort by it?
**Decision taken:** No. The storeText column sorts and filters on what it shows, as 313's Closed By column does. The
raw `profitCenter` column in the tail sorts by the raw value, and the file writes it.
**Why:** 313 set the precedent that sorting follows the shown text. A column that sorted on something it does not
display would look broken. I read "sort and export by this" as: the raw value exists as its own column for sorting and
exporting. Here it does, in the grid and in the CSV.
**Revisit if:** finance wants the display column itself ordered by profit center.

## Q: What class of CSV cell are the two fields?
**Decision taken:** `identity` for both, written as `="…"`. An unrecorded `profitCenter` writes an empty cell.
**Why:** Both are codes, not prose. With no profit center, `storeText` is the store code itself, and a bare `0104`
would reach Excel as the number 104. That is the store column's own reason for being `identity`.
**Revisit if:** a workbook needs the raw text without the wrapper.

## Q: A SIS.Api without 1990 sends no `storeText`. What do the papers print?
**Decision taken:** The store code, as they did before 1990 (`store-text.ts` → `paperStoreText`). This happens only
when the field is **missing**. A `storeText` the server does send always prints verbatim. The grids get no fallback:
the store code column sits right beside theirs.
**Why:** /code-review flagged the blank store on a printed record. `voucher-box.ts` already tolerates a missing field
the same way (312). The fallback composes nothing. It prints the code the paper already printed, which is also what
the server's formatter answers for a store with no profit center.
**Revisit if:** SIS.Api with 1990 is guaranteed to ship before the web, in which case the tolerance is dead code.

## Q: How does the RTL ACR sheet hold `PH-1204 (1204)` in a 52px column?
**Decision taken:** The value is wrapped in the shared `Ltr` isolate (`<bdi dir="ltr">`). It wraps at the space inside
the cell, as the WPF cell does (1990: "the 52 px cell wraps rather than clips"). No column width changed.
**Why:** It is a Latin code with a space inside an RTL row, which is `Ltr`'s documented rule. The drive measured the
worst case, a profit center on every row of every full page: 22 two-line rows still end inside A4 (row 832px against
sheet 1123px), the 47-row ACR is still 3 PDF sheets and the 23-row one still 2, and no cell overflows. A mutation
check: without the isolate the drive's direction check goes red. Chromium's bidi bracket-pair rule happens to keep
`(1204)` in order even without it, so the isolate is a belt, not a live fix.
**Revisit if:** the paper proof (BackOffice 1997 / oms-react 260) prefers the store cell on one line. That means a
narrower font or a wider column, which moves every other column.

## Q: Fixtures
**Decision taken:** Every ACR fixture row carries `PH-xxxx (xxxx)`, except the OPEN scenario's page 2, which prints the
code alone. Voucher `BASE` carries `PH-1042 (1042)`, and the BHD receipt carries `7301` alone.
**Why:** Once the owner's Plants DDL lands, every row has a profit center. The shipped print drive (151/151) now runs
its A4 geometry against that worst case, and both spellings are still covered.
**Revisit if:** a reviewer wants the fixtures left at the pre-DDL state.

## Not done here (owner / live)
- Nothing was driven against a live SIS.Api with 1990. Every envelope is stubbed.
- The owner's `Plants.ProfitCenter` DDL on POS_Server/HQ is BackOffice 1997's runbook act. Until it lands, a live door
  answers `profitCenter: ""` and `storeText` = the code, so the new column reads like the store code column.
- No human has looked at the printed paper with the wider store cell yet (a 260 / 1997 paper proof).

## Review round
- **/code-review:** 2 findings, both the same one. The papers printed `storeText` only, so a SIS.Api without 1990
  would leave the store blank on a printed record. **Taken:** `store-text.ts` (`paperStoreText`) falls back to
  `storeCode` only when the field is missing. A vitest suite and a drive check on each paper cover it.
- **/standards-review, Standards:** no hard violations. **Taken:**
  - two stale test names (default "six"/"ten" → "seven"/"eleven");
  - the column width matches Ready's 170;
  - `null` dropped from `paperStoreText`'s input;
  - a `storePair` helper in `collection-drive.mjs`;
  - a **Profit center** glossary entry in CONTEXT.md.
  **Declined:** a shared `StoreProfitCenter` interface over the three rows. The model file transcribes each wire model
  verbatim, one interface per door, and 1990 declined the same shared interface on the C# side. Also declined:
  sharing the two-line `storeText` column case and the csv kinds across screens. Each screen's column switch and kinds
  record is its own by the file's design, since the kinds record is what makes a new field fail typecheck per screen.
- **/standards-review, Spec:** no serious findings. **Taken:** the drive now also serves a 500 on both papers (a
  failure, never the miss, no sheet). **Kept as logged above:** the storeText column's sort, the paper fallback, and
  the ACR grid reading, which the ticket now records.
