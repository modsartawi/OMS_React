---
status: open
spec: 334
blocked-by: —
---

# 336 — All four collection screens export Excel as the grid is shown

BackOffice spec 2149 D4; web spec 334 item 2. Web only.

## What to build

Cash Collections, ACRs, failed attempts and deposits export a real `.xlsx` through the shared grid-to-Excel writer (`@/core/util/grid-xlsx`, as the central-invoice list and the deliveries screen already do): exactly the grid as shown — the filter, the sort and the visible columns.

- Money cells are numbers. Identity cells (store codes, receipt numbers, ids) are text, so leading zeros survive. Dates keep the screen's format.
- Arabic text is written as-is and opens correctly in Excel.
- The collection CSV writer, its `sep=` line and its tests are removed once nothing uses them. Check for other callers before deleting.
- The upload TEMPLATES (assignment, settlement bulk) are NOT part of this: they stay as they are.
- File names keep the current pattern with the `.xlsx` extension.
- Note on Cash Collections: today's CSV exports every column regardless of the More-columns toggle. The ruling is "the grid as shown", so the Excel export follows the toggle.

## Spine reach

oms-react screen / wire model / vitest

## Proof (→ `tdd` red-green cycles)

- [ ] `cash collections export writes the visible columns in grid order` · vitest
- [ ] `export keeps an Arabic description intact` · vitest
- [ ] `money is numeric and store codes are text in the sheet` · vitest
- [ ] `acr, attempts and deposits export through the same writer` · vitest
- [ ] `no collection screen still calls the csv writer` · vitest source test

## Boundaries

Web only. English locale only (Arabic appears inline where labels already carry it). No new dependency.

## Done when

Every collection screen's Export button downloads an `.xlsx` that opens in Excel with readable Arabic and the screen's own columns and order.

## Blocked by

None — can start immediately (if 335 landed first, the column list is the new one)
