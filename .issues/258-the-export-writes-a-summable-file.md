---
status: open
spec: 249
blocked-by: 255, 256
---

# 258 — The export writes a file the accountant can sum

## What to build

An **Export** button on all four screens, producing a CSV that lands in the accountant's
reconciliation workbook and **sums**.

**Why this exists at all, and why CSV.** The WPF's XLSX button is not a feature anybody chose — it is
inherited from `InquiryController`/`ListController` by ~40 unrelated screens, and it exports
`TextExportMode.Text`, so **every cell is text and the money cannot be summed**. The real use, settled
with the user in [248](248-whether-the-web-owes-a-spreadsheet.md), is an accountant reconciling in a
workbook. AG Grid **Community** has no `exportDataAsExcel` (Enterprise only), and a SheetJS-class
dependency buys nothing the CSV below does not — so this port is a straight **upgrade** over the
original, not a compromise.

**Client-side, over the rows already in the browser.**
[254](254-cash-collections-opens-on-today.md) holds the whole ~2,000-row result set client-side, so the
export needs **no walk, no server call, no progress bar and no backend ticket**. ⚠ Note the contrast
with `features/admin/ua-admin/export.ts`, which pages the server 120 times with a runaway guard, a
cancel path and a no-partial-file rule — none of that machinery is needed here, and copying it would
be cargo cult.

**Rows honour the active filter and sort.** The accountant exports the view they built.

### The two escaping rules, split by column

This is the part that is easy to get wrong while looking right, and it is where this writer
**deliberately departs from `ua-admin/csv.ts`**. That file wraps every cell in `="…"` so leading zeros
survive. ⚠ **For a column an accountant sums, that is exactly wrong**: a formula-text cell is *text*,
and `SUM` over it silently reads **zero**.

| Column class | Rule | Why |
|---|---|---|
| **Money** | Bare unformatted number — `1234.50`. No thousands separator, no symbol, no wrapper. | It must sum. A grouping comma makes the cell text and breaks the column silently. |
| **Identity** (receipt no., ACR no., store code) | `="…"` text wrapper | ⚠ The user confirmed the workbook **keys on receipt / ACR number**, so these must survive Excel intact — no eaten leading zeros, no `1.23457E+11`. |
| **Free text** (names, notes) | Injection guard — a leading `=`, `+`, `-` or `@` gets an apostrophe Excel eats on display | A display name must not **execute** when the file opens. |
| **Dates** | ISO text | So they sort. |

Currency stays its **own column** (the WPF's own ACR writer carries `CurrencyCode` for the same
reason).

**Every column ships, regardless of the More-columns toggle** — the file is the row unpacked, not the
grid screenshotted. `columns.test.ts` from ticket 254 already asserts the two groups' union is the
whole row; this ticket consumes that.

**File name:** `collection-{screen}-{YYYY-MM-DD}.csv`. Date only, no time — three exports in one week
do not collide; three in one day deliberately do.

**One writer, four screens** — each passes its own column definitions.

## Spine reach

logic (writer) · component (button) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `csv.test.ts` — the **two-rule split**, asserted per column class: a money cell is a bare
      summable number with no separator/symbol/wrapper; a receipt no. keeps its `="…"` wrapper and a
      leading zero survives; a note beginning `=` is inert; a value containing a comma or a newline
      stays one row; **every column appears regardless of the toggle state**; the file name carries
      the screen and the date · pure (prior art: `features/admin/ua-admin/csv.test.ts`)
- [ ] `csv.test.ts` — Arabic store and pharmacist names round-trip intact · pure
- [ ] `tools/collection-drive.mjs` extended — export from a **filtered and sorted** grid, read the
      downloaded file back, and assert it contains **only** the filtered rows **in the sorted order**,
      with the folded columns present · flow (Playwright)

## Boundaries

- **No API, no server call, no new dependency.**
- i18n keys for the button and the localised headers into the `collection` namespace. ⚠ Accepted cost,
  as `ua-admin` accepted it: the export is **localised**, headers included.
- The escaping primitives (`escape`, `freeText`, the formula wrapper, the preamble) overlap
  `ua-admin/csv.ts`. ⚠ **Do not extract to `@/core` in this ticket** — note it as a graduation
  candidate for whoever lands the *third* consumer, exactly as `pager.ts` and `money.ts` waited for
  their second. Two consumers that differ in every column rule is not yet an abstraction.

## Done when

All four screens export a CSV whose money columns sum in Excel, whose receipt and ACR numbers are
unmangled, whose Arabic names render, which carries every column and only the filtered rows in sort
order; the pure tests and the drive are green.

## Blocked by

- [255](255-acrs-and-attempts-list-on-the-same-template.md) and
  [256](256-deposits-shows-its-lines-and-balances.md) — one writer serving four screens needs all four
  column sets to exist, or it gets designed against one and retrofitted three times.

## Open questions

⚠ **Whether AG Grid's own `exportDataAsCsv` can carry the BOM — decide this first, it picks the
implementation.**

Spec 249 asserted a bespoke writer on the grounds that AG Grid's export is visible-columns WYSIWYG.
**That reason is wrong** — `allColumns: true` exists, and `processCellCallback` /
`processHeaderCallback` / `prependContent` cover the escaping rules, the localised headers and a
`sep=,` preamble. `features/pricing/bonus-buy-inquiry/export.ts` already uses this API.

The **real** constraint is narrower: ag-grid-community 36.0.1 has **no `suppressBom` param and never
emits a BOM** (verified against the installed bundle). Without one, Arabic names are mojibake on an
Excel double-click, and the leading `sep=,` line is what makes Excel's double-click path use `,`
rather than the Arabic locale's `;`.

1. **First try** `exportDataAsCsv` with `allColumns: true` and `prependContent: '﻿' + 'sep=,'`,
   and confirm the BOM lands as the **first bytes of the blob**. If it does, take it — it is far less
   code and reuses a pattern already shipped here.
2. **If it does not**, fall back to our own writer on `ua-admin/csv.ts`'s pure rows-in-string-out
   shape, fed by `api.forEachNodeAfterFilterAndSort` so the filter/sort guarantee is preserved.

Either way the Proof above is unchanged — it asserts the **file**, not the mechanism.
