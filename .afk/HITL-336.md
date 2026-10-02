# HITL — ticket 336 (all four collection screens export Excel as the grid is shown)

## Q: The shared writer exports any numeric value as a number. How do receipt, ACR and deposit numbers become text?
**Decision taken:** `gridSheet` in `@/core/util/grid-xlsx` gained two optional, per-column questions — `skip` and `asText`. The collection feature answers them in `xlsx.ts`: only a screen's money columns and its counts are numbers; every other cell is the text the grid shows. Deliveries and the central-invoice list pass nothing and write what they wrote before.
**Why:** The ticket says identity cells are text; on the wire `collectionReceiptNo`, `acrNumber` and `depositNumber` are numbers, so the writer's default would have totalled them.
**Revisit if:** the owner would rather the hint live on the column definition than in a per-screen list.

## Q: Counts (card slips, linked collections, slip count) — number or text?
**Decision taken:** Numbers. An unknown slip count is the dash the cell shows, as text.
**Why:** They are quantities an accountant may total; the CSV wrote them bare too. The dash is "the grid as shown" and must never read as 0.
**Revisit if:** finance wants an unknown count as an empty cell — the Slips column is then mixed number/text only where a count is unknown.

## Q: The actions column (Receipt / Form / Collections links) is a visible column. Is it in the file?
**Decision taken:** No. It is the one shown column left out.
**Why:** It holds links and no value; it would be a headed, empty column.
**Revisit if:** "the visible columns" is meant literally.

## Q: Dates — the CSV wrote raw ISO with seconds. What does the workbook write?
**Decision taken:** The text the cell shows: `yyyy-MM-dd HH:mm` for an instant, `yyyy-MM-dd` for a day. The seconds are no longer in the file.
**Why:** The ticket says "Dates keep the screen's format".
**Revisit if:** anyone matches the file against a POS log to the second. The derived span columns (ACR Collection Date, Deposits Business Date) are new to the file, as text like `2026-08-05 – 2026-08-06`.

## Q: Money headers — bare, or with the currency as on screen?
**Decision taken:** As on screen: `Net Collected (SAR)` when the result holds one currency. The Currency column is in the file only when it is on screen (More columns on, or a mixed-currency result).
**Why:** The export is the grid as shown. The CSV wrote bare headers and always carried Currency.
**Revisit if:** a downstream sheet keys on the old bare header names.

## Q: Should money cells carry a number format (two decimals, grouping)?
**Decision taken:** No format. The cell is the plain number (`11977.5`).
**Why:** The ticket asks for numbers; a fixed two-decimal format would be wrong for a three-decimal currency, and ACRs and deposits carry no currency to choose by.
**Revisit if:** finance wants the figures to open already formatted.

## Q: What is the worksheet called, and is there a toast?
**Decision taken:** The sheet is named by the screen's own title (Cash Collections, ACRs, Deposits, Collection Attempts), trimmed to Excel's rules. No success toast; a failure shows "The export failed" (two new keys under `export` in `collection.json`). The button is disabled while a file is being written.
**Why:** The CSV had no toast either; the writer is loaded on demand, so it can now fail and can be double-clicked.
**Revisit if:** the owner wants the "Exported N rows" toast the central-invoice list has.

## Q: The proof "export keeps an Arabic description intact" — there is no Description column until 335 lands.
**Decision taken:** The test writes Arabic into the grid's existing free-text column (Reason Detail) and the store and collector names.
**Why:** 335 had not landed when this slice was built. The export follows the grid, so the Description column will be in the file with no change here.
**Revisit if:** 335's reviewer wants the test re-pointed at Description once it exists.

## Note: two drive checks fail, and they are not this ticket's
`tools/collection-drive.mjs` ends 239/241. The two failures are `255 — …and it queries a business date of TODAY` and `255 — Reset returns to today…`. Commit b124dfe (27 Sep) made the ACR list land on today's *collection* date and did not update the drive. All 57 checks of this ticket pass.

## Note: comment-only edits outside the inquiry folder
`settlement/bulk-template.ts`, `fleet-fixture.ts` and `settlement-fixture.ts` cited the deleted `csv.ts` / `csv.test.ts` in comments. The comments were re-pointed; the template's bytes and its no-BOM rule are untouched.
