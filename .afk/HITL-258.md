# HITL — ticket 258 (the export writes a summable file)

## Q: AG Grid's `exportDataAsCsv` or a bespoke writer? (the ticket's stated Open Question)

**Decision taken:** a bespoke pure writer (`csv.ts`), fed by `api.forEachNodeAfterFilterAndSort`
— the ticket's option 2.

**Why:** the ticket's stated reason for the fallback turned out to be **wrong in our favour**, and a
different, harder reason forces the fallback anyway.

1. **The BOM premise is stale.** `ag-grid-community` 36.0.1 *does* emit a BOM — `csvCreator.ts`
   packages the file as `new Blob(["﻿", data], { type: "text/plain" })` (verified in
   `node_modules/ag-grid-community/dist/package/main.esm.mjs`, the `CsvCreator.export` body). So
   the ticket's "never emits a BOM" is not true of this version, and the suggested
   `prependContent: '﻿' + 'sep=,'` would have produced a **double** BOM. That path is not a
   blocker — but it is not what decides this either.
2. **`allColumns: true` cannot reach the folded columns.** Tickets 254–256 implement the
   **More columns** toggle by *rebuilding `columnDefs`*, not by setting `hide` — the forensic tail
   columns do not exist in the grid at all while the toggle is off. `allColumns` exports the
   grid's columns *including hidden ones*; it cannot export columns that were never defined. The
   ticket's hardest requirement — *"every column ships, regardless of the More-columns toggle"* —
   is therefore unreachable through `exportDataAsCsv` without restructuring all four column
   builders to `hide`-based toggling, which would rewrite three shipped slices.
3. A pure writer is also what makes the ticket's own Proof (`csv.test.ts`, node, no DOM) possible
   at all: AG Grid's serializer needs a live grid.

**Revisit if:** the four column builders ever move to `hide`-based folding, or AG Grid Community
gains a way to export a column definition the grid does not hold. Then option 1 becomes reachable
and is less code.

## Q: what does a "date" column look like in the file?

**Decision taken:** the **raw wire ISO string** for a datetime (`2026-08-08T15:40:00`) and
`yyyy-MM-dd` for a day-only field (`salesDate`, `acrDate`, `businessDay`), both with the .NET
`0001-01-01` sentinel rendered blank.

**Why:** the ticket says *"Dates → ISO text, so they sort"*. The raw value sorts lexically **and**
keeps the seconds the grid's `yyyy-MM-dd HH:mm` cell drops — the file is the row unpacked, not the
grid screenshotted. The sentinel is blanked because a year-1 date is an *absence* on these rows
(the grid blanks it for exactly that reason), and a literal `0001-01-01` in a workbook column reads
as data.

**Revisit if:** the accountant wants Excel to parse the column as a real datetime rather than as
text — that wants a space instead of the `T`, which is a formatting decision, not a fidelity one.

## Q: which columns count as "identity" (the `="…"` wrapper)?

**Decision taken:** the ticket's three named ones (receipt no., ACR no., store code) **plus** the
other columns that are opaque record/person keys rather than quantities: `collectorOperatorId`,
`closerOperatorId`, `collectorStaffId`, `depositNumber`, `depositId`, `shiftId`, `bankCode`.

**Why:** the ticket's list is parenthetical rather than exhaustive, and the rule behind it — *the
workbook keys on it, so it must survive Excel intact* — applies identically to an operator id (a
numeric string that can carry a leading zero and is long enough to reach `1.23457E+11`). The rule
is stated in `csv.ts` as *"a code that identifies a record, a person or a place — never a
quantity"*, which is what keeps a money column out of it.

**Revisit if:** finance says they sum or arithmetic on one of these — then it is a quantity and
must lose the wrapper.

## Q: does the CSV money header carry the currency code the grid's header carries?

**Decision taken:** no — the CSV header is the bare column label, and `Currency` ships as its own
column (it is already in the Cash Collections field list).

**Why:** the ticket says *"Currency stays its own column"*, and the grid's `Net Collected (SAR)`
header is a screen device that depends on the result holding exactly one currency. A header that
changed shape with the result would make two exports of the same column disagree.

**Revisit if:** the ACR and Deposit rows gain a `currencyKey` (already logged as a server change in
`.afk/HITL-255.md` and `.afk/HITL-256.md`) — then those two files gain a Currency column too.

## Q: does the Export button offer itself when the grid is filtered down to nothing?

**Decision taken:** no — it goes disabled, tracked by the grid's **displayed** row count
(`onModelUpdated` → `getDisplayedRowCount()`), not by the fetched `rows.length`.

**Why:** raised by `/code-review`. The file is written from `forEachNodeAfterFilterAndSort`, so a
grid narrowed to zero rows by the floating filter would have downloaded a headers-only CSV under
the day's file name — a file that is indistinguishable from "there were no collections today" once
it is in a folder. Nothing in the ticket asks for a disabled state; this is a small, argued
addition rather than an inherited one, and it is asserted in the drive.

**Revisit if:** an accountant wants the header row alone as a template. That is a different
feature and would want a different name.

## Q: four identical copies of the export wiring, or one hook?

**Decision taken:** one hook, `use-csv-export.ts`, **inside the feature**.

**Why:** raised by `/standards-review` as the strongest smell. 244 §1's copied-not-extracted
ruling is about the screen's *shape* — gate, toolbar, criteria draft, grid — which stays literally
duplicated. This is one control's plumbing, and it arrived at **four** identical copies in a single
slice; `GridStates.tsx` and `cap.ts` already document that exact escalation path inside this
feature, one layer below `core/`. No shared inquiry shell was created and nothing moved to `core/`.

**Revisit if:** a fifth screen needs a materially different export (a server walk, a confirm) —
then it takes its own path rather than growing options on this hook.

## Outstanding — not this ticket's to close

- ⚠️ **The ACR and Deposit CSVs carry no Currency column**, because `AcrInquiryRow` and
  `DepositInquiryRow` carry no `currencyKey` on the wire — already logged as a server change in
  `.afk/HITL-255.md` and `.afk/HITL-256.md`. The client cannot state a currency that is not on the
  wire, and `SAR` would be wrong on a Bahrain run. Both files gain the column with no code edit
  the day the field lands, because the columns are read from the screens' own field groups.


- Nothing needing a live SIS.Api: this ticket makes **no server call at all**. The drive runs
  against the same mocked `CollectionWeb/*` envelopes the wave's earlier slices established.
