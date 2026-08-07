---
type: wayfinder-map
status: done
---

# 240 — The collection documents come to the web

## Destination

A **ready spec** (`/to-spec` → `/to-tickets`) for porting the WPF collection suite to oms-react,
read-only, for the **collection supervisor** and the **accountant**: four inquiry screens
(Collection Inquiry, ACR Inquiry, Deposit Inquiry, Collection Attempts) plus the two printable
documents they open — the سند قبض **collection receipt** and the **ACR** (نموذج متابعة المبيعات
النقدية ومبيعات الشبكة، the accumulated collection receipt).

**The breaker:** both documents must reproduce the WPF/paper form *exactly*. The spec is not ready
until a side-by-side render of each template has been signed off by the user against its WPF
original. Everything else on this map serves that gate.

The spec slices into **two waves**: the frontend wave in this repo (the four screens + the two
facsimiles + print), and a smaller backend wave in
`C:\Work\DMSCO\BackOffice` (print-ready model endpoints). They are meant to be runnable in parallel.

## Notes

- **Domain:** POS collection / finance. `CONTEXT.md` is the glossary; the WPF vocabulary
  (collection, ACR, shift, Z-report, variance عجز/فائض, مطابقة, deposit) carries over unchanged.
- **The WPF originals** (read these before deciding anything about the documents):
  - Receipt facsimile — `C:\Work\DMSCO\BackOffice\Sartawi.Retail\Collection\Voucher\CollectionVoucherControl.xaml`
    (+ `CollectionVoucherPager.xaml`, `CollectionVoucherPrinter.cs`, `CollectionVoucherWindow.xaml`, `logo-aldawaa.png`)
  - ACR facsimile — `C:\Work\DMSCO\BackOffice\Sartawi.Retail\OMS\AcrInquiry\AcrFormControl.xaml`
    (+ `AcrFormPrinter.cs`, `AcrFormExcelWriter.cs`, `AcrFormWindow.xaml`)
  - Screens — `Sartawi.Retail\OMS\CollectionInquiry`, `OMS\AcrInquiry`, `OMS\DepositInquiry`,
    `OMS\CollectionAttempts`
  - The brains — `Sartawi.Retail.Data\Modules\Pos\Services\Voucher\CollectionVoucherBuilder.cs`
    and `AcrFormBuilder.cs` (+ their tests under `Tests\Data.Tests\`)
  - Paper references named in the XAML comments —
    `Sartawi.POS\NewPos\Shifts\Images\Collection Receipt.jpg` and `Scanned Document 4.pdf`
- **The server read spine already exists**: `Services\SIS.Api\Endpoints\Pos\PosCollectionEndpoints.cs`
  (`PosCollection/CollectionInquiry`), `AcrEndpoints.cs` (`Acr/Inquiry`, `Acr/Report`, `Acr/My`, …),
  `DepositEndpoints.cs`, `CollectionAttemptEndpoints.cs`. No new query or projection is expected —
  the backend wave is about **exposing the existing C# builders**, not new data.
- **Settled at chart time, do not re-litigate:**
  - The WPF POS keeps its own XAML voucher. Nothing is shared as code with POS; "same form" means
    the web output matches the WPF output, not that one component serves both.
  - The builders move **server-side**. React renders a print-ready model (pre-formatted money,
    Arabic amount-in-words, pre-paginated pages) so the two clients cannot drift.
  - The screens are **read-only** — inquire, view, print. Creating and closing ACRs stays in POS/WPF.
  - The facsimiles are a **documented exception** to `i18n-zero-literal` and `logical-tailwind`:
    the Arabic *is* the form. Screen chrome around them obeys every rule.
  - Fidelity is proved by **side-by-side visual sign-off** with the user, per template.
- **Skills:** `/grilling` + `/domain-modeling` for the screen and contract tickets, `/research`
  for the print-path and read-spine tickets, `/prototype` for the two facsimile tickets.
- **Design language:** the four screens use ours (PosTheme steel-blue, AG Grid, the existing
  inquiry-screen shape). The two documents deliberately do **not** — they are paper facsimiles.

## Decisions so far

<!-- one line per resolved ticket -->

- [Every mark on both forms, written down](242-every-mark-on-both-forms-written-down.md) — the
  fidelity inventory exists ([asset](assets/242-fidelity-inventory.RESEARCH.md), + a checked-in
  render of the ACR paper scan); both papers reconciled against the XAML, every formatting rule
  named with its pinned test values. Two findings: the **ACR is a reshape, not a facsimile** (the
  paper's DMSCO logo, 18 pre-ruled rows, signature column, five-row summary and instruction blocks
  are all gone), so "matches the WPF" ≠ "matches the paper" for that document; and `مطابق` can
  never render on the HQ path the web will use. Nine open questions left deliberately unresolved
  as the agenda for 245/246/247.

- [What a browser can print a paper form with](241-what-a-browser-can-print-a-paper-form-with.md) —
  **browser print**, on a dedicated print route with `@page{size:A4;margin:0}` and one block per
  server-paginated page: WPF never lets a layout engine break pages either (`Paginate(rowsPerPage:
  22)` is arithmetic), the paper original already shrink-fits to ~96 % so "exactly" is looser than
  it reads, and `System.Printing` is unsupported in ASP.NET so a server PDF would be a *third*
  rendering — while the only cheap PDF path (headless Chromium) renders this very HTML anyway.
  Gate must verify the header/footer stamp on real Chrome **and** Edge.

- [What the server already hands over](243-what-the-server-already-hands-over.md) — both documents
  **are** already reachable (the receipt is pure row-mapping off `CollectionInquiry`; `Acr/Report`
  returns *exactly* `AcrFormBuilder.Build`'s input type) and SIS.Api already project-references the
  builders' assembly, so that half is "add an endpoint". But the browser is **shut out**: issue
  802's default-deny means all four endpoints answer a browser **403**, so the backend wave is
  really *five `*Web/*` doors + four screen gates* (the `BbyInquiryWebEndpoints` pattern, grants 1:1
  with the WPF `ControllerID`s, zero new SQL). Mocking the frontend wave is therefore **required**,
  not optional.

- [The receipt, side by side with the paper](246-the-receipt-side-by-side-with-the-paper.md) —
  **breaker gate 1 passed.** Signed off on variant C of the
  [prototype](../src/features/oms/collection/__prototype__/voucher/) (three readings + the paper
  scan, on 241's print geometry): where the WPF departed from the pad *knowing something the pad
  could not*, keep it (`Store. {code}`, ISO dates); where it departed by accident, go back to the
  pad (dot leaders, `Receiver`/`Pharmacist` restored, `P.O. Box` bold, `No.`/`Store.` at the outer
  edges on the subtitle line). **Two amendments shrink the contract 245 must write:** the green
  POSTED banner is gone (`No.` *is* the posted state) and the `خصم فائض` box is **always empty** —
  so the receipt's model carries **no reconciliation data at all**, not `IsPosted`, not
  `VarianceText`, and not the `CashRounding` flags O4 was asking about. Also widened the map's
  documented-exception list to a **third** rule — the colour-literal gate, since `#C00000` *is* the
  form. Two things left open: the pad's **horizontal** logo lockup exists in neither repo (one
  decision shared with 247/O8), and 241's stamp-and-fills check has still never met a printer.

- [The ACR form, across its pages](247-the-acr-form-across-its-pages.md) — **breaker gate 2 passed,
  so the breaker is clear on both documents.** Signed off on variant C of the
  [prototype](../src/features/oms/collection/__prototype__/acr/) (three readings × four paging
  scenarios, on 241's geometry): 246's rule survives contact with a *reshape* — the WPF's
  `تاريخ اليوم`, the closer's id over a signature column, dynamic rows and the page stamp all stay;
  `الموافق` and the pad's left/right placement of `ملخص التحصيل` come back; the three difference
  rows, `سبب الفرق` and both instruction blocks stay dropped. **Three amendments, all reaching 245:**
  `رقم المشغل` → **`رقم الصيدلي`** (the field is `pharmacistId`), `نموذج رقم ( )` →
  **`رقم التجميعي`**, and **every deposit mark removed** — meta *and* summary — which answers
  §8-O7 OUT and takes `DepositText` with it. **Pagination holds**: the break is arithmetic
  (`paginate(rows, 22)`), the header repeats, the sequence runs unbroken, and the worst case — one
  row alone on the last page under the whole summary block — is legible. Two findings for the
  builder: a negative figure needs an **LTR island** (242 §1.1's list was one short; the WPF has the
  same bug), and **O8's logo is now the last unfinished mark on either document** — it needs an
  asset from the brand side, not a decision on this map.

- [Four inquiry screens in our clothes](244-four-inquiry-screens-in-our-clothes.md) — all four
  screens settled as **one feature in a new top-level area**, `src/features/collection/` at
  `/collection/*` under a **Collections** menu group (finance, not OMS — following how
  `callcenter`/`loy`/`nphies` each minted a group), templated on **BBY Inquiry's shape, copied not
  extracted**, with the `246`/`247` prototypes moving there. Four rulings carry weight downstream:
  the WPF's **`Limit` box is deleted** — scope is HQ-wide and a day is hundreds of rows, so the web
  asks for ~2,000 and pages 50 at a time **in the browser**, keeping sort/filter/export over the
  whole set and sparing four endpoints an `OFFSET/COUNT` change; screens **open auto-loaded on
  today**; the ACR drill-down is `?acr=` on Cash Collections with a chip that **disables the other
  filters**, because the server treats `AcrId` as exclusive; and documents open **in a new tab at
  their own URL**, which is free for the ACR (`Acr/Report?acrId=`) but needs 245's by-number lookup
  for the receipt. Also: **`money.ts` graduates from Loy to `@/core`** (second consumer, as
  `pager.ts` did), the floating-filter row is **on** by default (inverting BBY, matching every WPF
  grid), columns lead with identity+money and fold a forensic tail behind a toggle, Deposit renders
  its lines and per-collector balances **stacked in place**, and permissions are the **four existing
  WPF grants** behind one `Collection/Access` probe — supervisor vs accountant is grant *assignment*,
  neither is store-scoped. Unblocks 248, and hands it the finding that the WPF grids export **XLSX**.

- [The shape of a print-ready document](245-the-shape-of-a-print-ready-document.md) — the contract
  is written, field-by-field, for `/to-spec` to lift verbatim. **One door, not five**: a single
  `CollectionWebEndpoints.cs` (tag `CollectionWeb`) carries all seven routes with the four WPF grants
  enforced per-route, following `SdDocumentWeb`'s one-tag-several-gates shape and 244's single
  `Access` probe. **The wire carries strings and nothing else** — no `decimal`, no `DateTime`, no
  `currencyCode` — so the client is *unable* to format rather than merely asked not to; every
  unrendered field (`storeName`, `variance`, `hasShiftReport`, `createdAtText`) leaves with them.
  Both documents hand over **pages**: the ACR as a hoisted `form` + `pages[]` (243's caveat — a naive
  `List<AcrFormPage>` repeats the header and all rows once per page), and the receipt likewise,
  because a multi-shift receipt is genuinely multi-page. **Three findings became server work**: the
  receipt has no identity on the wire today, so `CollectionReceiptId` joins the projection, model and
  options and becomes the URL key (`SequentialNumber` is minted *per store*, so `No.` cannot do it);
  the HQ path's `MarkPosted(oneItemList, …)` mints **duplicate `No.`s** on a multi-shift receipt, so
  the door must stamp the page set as a set, ordered `OpenedAt` ascending; and `shiftDayName` +
  247's new `hijriText` must be **pinned formatters with pinned tests** (`ar-SA` / explicit
  `UmmAlQuraCalendar`) because net8.0 is not WPF's globalization stack and the failure mode is a
  silent English `Thursday`. A miss is an **envelope refusal** (`AcrNotFound` reused,
  `CollectionReceiptNotFound` minted), never a bare 404 and never a blank sheet — but **empty is not a
  miss**. And the frontend **starts against a mock**: the two prototype fixtures graduate into the
  feature, with three boundaries written down and the first live call named as its own verification.

- [Whether the web owes a spreadsheet](248-whether-the-web-owes-a-spreadsheet.md) — **split, and the
  map is done.** The two XLSX exports turned out to be different objects: the grid one is a *base
  class* (`ExportToXlsx` sits in `InquiryController`/`ListController`, inherited by ~40 screens,
  exporting `TextExportMode.Text` so its money isn't even summable), while `AcrFormExcelWriter` is
  bespoke — and already writes `رقم المشغل`, `نموذج رقم` and both deposit rows that 247 renamed and
  deleted, making it this map's drift argument *already realised*. So the ACR form's Excel is **ruled
  out of scope** (a third rendering, 241's exact reasoning) and 245's strings-only wire survives
  untouched. The four grids **do** owe one — the accountant reconciles it — as **client-side CSV**,
  which needs **zero backend work** (244 already holds all ~2,000 rows in the browser, so no walk,
  unlike ua-admin's 120-page one) and no dependency (AG Grid *Community* has no `exportDataAsExcel`).
  The writer's non-obvious rule: **two escaping rules split by column** — money leaves as a bare
  unformatted number (`ua-admin`'s `="…"` habit would make the cell text and silently `SUM` to zero),
  receipt/ACR/store ids keep the wrapper because the workbook keys on them. All columns ship
  including 244's folded forensic tail, which is why AG Grid's own WYSIWYG `exportDataAsCsv` can't be
  the implementation.

## Not yet specified

<!-- empty: no fog is left toward the destination; every ticket on this map is resolved -->

*(The one patch here — Deposit Inquiry and Collection Attempts in detail — was **answered**, not
graduated, by [Four inquiry screens in our clothes](244-four-inquiry-screens-in-our-clothes.md):
both grids' columns and filters are settled, Deposit's balance summary earns its own stacked
surface, and neither screen justifies a ticket of its own.)*

## Out of scope

<!-- work ruled beyond the destination -->

- **Any change to the WPF POS or its XAML voucher.** The POS keeps its own; this effort adds a web
  rendering beside it, it does not unify them.
- **Write actions** — `Acr/Create`, `Acr/Close`, collecting a shift, reopening. The web is an
  inquiry surface; the acting stays in POS/WPF.

- **An Excel rendering of the ACR *document*** (the WPF's `AcrFormExcelWriter` — the 13 columns,
  totals row and ملخص التحصيل block written as a worksheet). A web twin would be a **third**
  rendering to keep in sync with the WPF writer and the React facsimile — 241's exact argument
  against a server PDF — and the WPF writer has already fallen three marks behind 247. Print the
  form, export the grid; the ACR Inquiry grid's rows *are* the form's rows. Returns only as its own
  effort. Ruled out by
  [Whether the web owes a spreadsheet](248-whether-the-web-owes-a-spreadsheet.md).
