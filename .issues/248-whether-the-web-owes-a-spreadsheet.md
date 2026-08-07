---
type: wayfinder-ticket
wayfinder: grilling
map: 240
status: done
blocked-by: 244
---

# 248 — Whether the web owes a spreadsheet

## Question

Graduated from the map's **Export parity** fog once
[What a browser can print a paper form with](241-what-a-browser-can-print-a-paper-form-with.md)
settled the print path as client-side. Export no longer hangs on that decision, so the question is
now sharp — and it is a scope question first, a mechanism question second.

The WPF suite offers XLSX in two distinct places, and they are not the same feature:

1. **Out of every inquiry grid** — `PrintableControlLink.ExportToXlsx`, a generic "dump this grid"
   affordance sitting on Collection Inquiry, ACR Inquiry, Deposit Inquiry and Collection Attempts
   alike.
2. **Out of the ACR form** — a dedicated `AcrFormExcelWriter` that writes the *document*, not a
   grid: the 11 columns, the totals row, the ملخص التحصيل block. A second rendering of the
   facsimile, in a third medium.

Settle, with the user:

- **Does the web owe either?** Who actually uses these exports today and for what — is the
  accountant pasting a grid into a reconciliation workbook, or is this a WPF affordance nobody
  asked for that got added because the control offered it? Read `AcrFormExcelWriter.cs` before the
  conversation so the second one can be judged on what it really produces.
- **If the grids owe an export**, is it client-side off the AG Grid rows already in memory (fast,
  free, exports exactly what's on screen including the active filter) or a server endpoint (exports
  the whole result set past the page, needs a backend-wave ticket)? The answer turns on whether
  users export a filtered view or a full month.
- **If the ACR form owes one**, note that it becomes a **third** rendering to keep in sync with the
  WPF writer and the React facsimile — the same drift argument that ruled server PDF out in 241.
  Establish whether that cost is worth paying, or whether "print the form, export the grid" covers
  the real need.

A defensible "no, and here's what the users do instead" is a complete answer. If the answer is yes
in either place, say which wave owns it and whether it belongs in this spec or a follow-on effort.

## Answer

**Split. The grids owe an export and the web builds it this wave; the ACR form does not and is
ruled out of scope.** The two exports turned out to be entirely different objects, and reading them
before the conversation is what separated them.

### §1 — The two exports are not one feature

**The grid XLSX is a base class, not a decision.** `ExportToXlsx` is implemented once in
`Sartawi.Core\Controller\InquiryController.cs:279` and again in `ListController.cs:268`, and **~40
controllers inherit it** — Nphies, Wasfaty, Qitaf, Coupons, P2E, BBY, Rsd, the four collection
screens among them. No one specified it for Collection Inquiry; it arrived with the base class. It
is a DevExpress `PrintableControlLink` over the grid's `TableView` with
`XlsxExportOptions(TextExportMode.Text)` — so **every cell exports as text**, money included. The
WPF export cannot be summed in the workbook it lands in. Hold that thought; §3 is about to make it
the whole point.

**The ACR writer is bespoke, and already drifted.** `AcrFormExcelWriter.cs` is 114 hand-written
lines: an RTL worksheet named `ACR {number}`, a merged Arabic title, five two-column meta rows, the
13-column table with `EDEDF2` headers and hair inside borders, the `الاجمالي` totals row, and the
`ملخص التحصيل` block. Its stated design rule is the opposite of the grid's: *"money lands as
NUMBERS (finance sums/filters them), presentation-only fields as the builder's texts so Excel and
paper never disagree."*

That file is also this map's own drift argument, already realised. It still writes `رقم المشغل`,
`نموذج رقم` and both deposit meta rows (`رقم الإيداع البنكي`, `حالة الإيداع`) — the exact three
marks [The ACR form, across its pages](247-the-acr-form-across-its-pages.md) renamed and deleted.
It has already fallen behind a form it renders. Its own comments carry two "Slice 2" annotations
patching it toward a moving target.

### §2 — Ruling on the ACR form Excel: **no** (out of scope)

A React `AcrFormExcelWriter` would be a **third** rendering of the same document — the WPF writer,
the React facsimile, and it — to keep in sync. That is precisely the argument
[What a browser can print a paper form with](241-what-a-browser-can-print-a-paper-form-with.md)
used to rule out a server PDF, and §1's evidence is the empirical proof: the WPF's own third
rendering is *already* wrong on three marks after one revision. Adding ours would double the
surface that 247's amendments have to reach.

It is ruled **out of scope for this map**, not "no forever". The map's Out-of-scope section records
it. If finance later wants the ACR *document* numerically, that is its own effort with its own
justification — and §3's grid export covers most of what it would have been for, because the ACR
form's rows and the ACR Inquiry grid's rows are the same rows.

**Consequence for [The shape of a print-ready document](245-the-shape-of-a-print-ready-document.md):
none.** 245's strings-only wire ruling survives untouched. Had this gone the other way, the document
contract would have needed numeric twins of every money field and the "the client is *unable* to
format" property would have been lost.

### §3 — Ruling on the grid export: **yes**, client-side CSV, this wave

The user established the real use: **the accountant reconciles it** — the file lands in a
reconciliation workbook where the money columns are summed and filtered. That single fact decides
the mechanism and the format.

**Client-side, off the rows already in memory.** [Four inquiry screens in our
clothes](244-four-inquiry-screens-in-our-clothes.md) deleted the WPF `Limit` box and holds ~2,000
rows in the browser, paging 50 at a time client-side. The whole result set is therefore *already*
in the grid — the export needs no walk, no `OFFSET/COUNT`, and **no backend-wave ticket at all**.
This is strictly cheaper than the precedent: `features/admin/ua-admin/export.ts` had to page the
server 120 times with a runaway guard, a cancel path and a no-partial-file rule because the estate
did not fit in the browser. Here none of that machinery is needed. The rows honour the **active
filter and sort**, which is what an accountant exporting a reconciliation view wants.

**CSV, not XLSX.** AG Grid **Community** — the licence this repo is on — ships `exportDataAsCsv`;
`exportDataAsExcel` is Enterprise. Real XLSX means either a licence or a SheetJS/exceljs runtime
dependency (~400KB) plus a writer to maintain. CSV costs nothing, and against the stated need it
loses nothing: the WPF XLSX exports **text-mode cells**, so the CSV specified below — money as bare
numbers — is *more* useful in the reconciliation workbook than the thing it replaces. This is a
rare case where the port is a straight upgrade over the original.

### §4 — The writer's rules (the part that is not obvious)

`ua-admin`'s `csv.ts` is the shape to follow but **not** the rules to copy. Its habit is to wrap
every cell in `="…"` so leading zeros and long ids survive Excel. For an accountant summing a
column that is exactly wrong: a formula-text cell is **text**, and `SUM` over it reads zero. So the
file has **two rules split by column**:

- **Money columns → bare unformatted number.** `1234.50` — no thousands separator, no currency
  symbol, no `SAR`. A grouping comma would make the cell text and silently break the sum, which is
  the one failure the accountant would not notice. Currency stays as its own column (the WPF writer
  carries `row.CurrencyCode` for the same reason).
- **Identity columns → `="…"` text wrapper.** The user confirmed the workbook keys on **receipt no.
  / ACR no.**, so those two are load-bearing: they must survive Excel intact, no eaten leading
  zeros, no `1.23457E+11`. Store code joins them.
- **Free text → the injection guard.** `ua-admin`'s `freeText` (leading `=`, `+`, `-`, `@` get an
  apostrophe) carries over unchanged — pharmacist names and notes must not execute.
- **Dates → ISO text**, so they sort. Same reason as the map's other ISO rulings.
- **BOM + `sep=,` preamble** carry over verbatim from `csv.ts`: the BOM is what makes the Arabic
  store and pharmacist names render, and `sep=,` is because Excel's double-click path uses the OS
  list separator — `;` in an Arabic locale.

**Every column, including the folded tail.** 244 folds a forensic column tail behind a toggle; the
file carries **all** columns regardless of the toggle state, in the columns' canonical order — the
same principle `csv.ts` states as *"the file is the wire row unpacked, not the grid screenshotted"*.
The rows honour the active filter; the columns do not honour the toggle. This also rules out AG
Grid's own `exportDataAsCsv` as the implementation, since its default is visible-columns-WYSIWYG —
so the writer is **ours**, following `csv.ts`'s pure rows-in-string-out shape, and AG Grid supplies
only the filtered/sorted row set.

**One writer, four screens.** Collection Inquiry, ACR Inquiry, Deposit Inquiry and Collection
Attempts each pass their own column definitions to one generic writer. File name follows
`csvFileName`'s pattern: `collection-{screen}-{YYYY-MM-DD}.csv`.

### §5 — What this hands `/to-spec`

- One frontend story: **"export the grid"** on all four collection screens, client-side CSV, no
  server call, no new dependency. Sized as one build ticket plus a pure-writer test file — the
  column-rule split in §4 is exactly what a `vitest` unit test pins.
- **Zero backend-wave work.** The backend wave stays as
  [The shape of a print-ready document](245-the-shape-of-a-print-ready-document.md) left it: one
  `CollectionWebEndpoints.cs` door, seven routes, four grants.
- A candidate for `@/core` on the second consumer, exactly as `pager.ts` and `money.ts` did — but
  **not** on this wave. `ua-admin`'s writer and this one share the escaping primitives (`escape`,
  `freeText`, `formulaText`, the BOM/`sep=,` preamble) and differ in every column rule. Note it as
  a graduation candidate for whoever lands the third consumer; do not extract speculatively.
