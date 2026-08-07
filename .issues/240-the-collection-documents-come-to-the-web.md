---
type: wayfinder-map
status: open
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

## Not yet specified

- **Deposit Inquiry and Collection Attempts in detail.** 243 settled the document question —
  **neither carries one**; Deposit has attachment URLs and a `{ Rows, Balances }` shape instead of a
  bare list, and Collection Attempts is one flat list with six filters. What remains dim is each
  grid's columns and filters, whether Deposit's per-collector balance summary earns its own surface
  on the screen, and whether the two justify their own tickets or ride along with 244 — reachable
  only once the screen shape is settled.

## Out of scope

<!-- work ruled beyond the destination -->

- **Any change to the WPF POS or its XAML voucher.** The POS keeps its own; this effort adds a web
  rendering beside it, it does not unify them.
- **Write actions** — `Acr/Create`, `Acr/Close`, collecting a shift, reopening. The web is an
  inquiry surface; the acting stays in POS/WPF.
