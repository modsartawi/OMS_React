---
status: done
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

- [x] `cash collections export writes the visible columns in grid order` · vitest
- [x] `export keeps an Arabic description intact` · vitest
- [x] `money is numeric and store codes are text in the sheet` · vitest
- [x] `acr, attempts and deposits export through the same writer` · vitest
- [x] `no collection screen still calls the csv writer` · vitest source test

## Boundaries

Web only. English locale only (Arabic appears inline where labels already carry it). No new dependency.

## Done when

Every collection screen's Export button downloads an `.xlsx` that opens in Excel with readable Arabic and the screen's own columns and order.

## Blocked by

None — can start immediately (if 335 landed first, the column list is the new one)

## Comments

**Built 2026-09-30 (AFK).**

- The four grids export through `@/core/util/grid-xlsx`. `gridSheet` gained two optional per-column answers, `skip` and `asText`; `features/collection/inquiry/xlsx.ts` says which columns are figures (money and counts) and leaves the actions column out. Deliveries and the central-invoice list are unchanged.
- Removed: `csv.ts`, `csv.test.ts`, `export.ts`, `use-csv-export.ts`. No other caller existed. `downloadCsv` in core stays: the two upload templates and UA Users still use it.
- Proof is in `src/features/collection/inquiry/xlsx.test.ts` (the five named blocks) and three cases in `src/core/util/grid-xlsx.test.ts`. The vitest grid is a stand-in api over the screens' real column definitions.
- Driven: `tools/collection-drive.mjs` downloads each workbook in Chromium (stubbed envelopes, vite on 5199) and reads its XML back — 57 checks for this ticket, all passing: visible columns in grid order with the toggle off and on, filtered and sorted rows, money as number cells, identity as text cells, Arabic intact.
- The drive as a whole ends 239/241. The two failures are ticket 255's landing-query checks, stale since commit b124dfe; not touched here.

**Outstanding (owner):**

- Open an exported `.xlsx` in real Excel and read the Arabic. The drive proves the bytes, not the rendering.
- No run against a live SIS.Api.

Decisions taken unattended are in `.afk/HITL-336.md` — chiefly: dates leave as the screen shows them (the CSV's seconds are gone), money headers carry the currency as on screen, the actions column is not written.
