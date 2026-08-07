# 241 — What a browser can print a paper form with

Research asset for wayfinder ticket
[241](../241-what-a-browser-can-print-a-paper-form-with.md) on map
[240 — The collection documents come to the web](../240-the-collection-documents-come-to-the-web.md).

**Recommendation: browser print.** A dedicated print route rendering the same React facsimile the
screen shows, `@page { size: A4; margin: 0 }`, one fixed-size block per pre-paginated model page,
`window.print()`. Server-rendered PDF is a *later* effort with named triggers (§6), and its
cheapest form is a headless Chromium pointed at the very route we are about to build — so
building browser print first is not a bet against PDF, it is the first half of it.

---

## 1. The finding that decides it: pagination was never a layout problem

The ticket asked whether the ACR's page-splitting is the deciding factor. It is — and it decides
*for* the browser.

Both WPF printers build a `FixedDocument` with **one page per model page**, each a fresh control:

```csharp
// AcrFormPrinter.cs / CollectionVoucherPrinter.cs — BuildDocument
foreach (var model in pages)
{
    var page = new AcrFormControl { DataContext = model };
    ...
    document.Pages.Add(pageContent);
}
```

and the split itself is pure arithmetic in the builder, not the layout engine:

```csharp
// AcrFormBuilder.cs:201
public static List<AcrFormPage> Paginate(AcrForm form, int rowsPerPage = 22)
{
    for (var i = 0; i < form.Rows.Count; i += rowsPerPage)
        chunks.Add(form.Rows.Skip(i).Take(rowsPerPage).ToList());
    ...
    ShowSummary = i == chunks.Count - 1,
}
```

WPF **never asks the layout engine where to break.** It is handed N pages and prints N pages;
`ShowSummary` puts the totals + ملخص التحصيل + signature block on the last one.

The map has already settled that the model arrives from the server pre-paginated. So the browser
inherits exactly the same job: render N blocks, `break-after: page` on each. There is no reflow
decision to get wrong, no `break-inside: avoid` heuristic to trust, no repeating-table-header
problem — every page carries its own header because `AcrFormPage` already carries the header
fields (`Form.AcrDateText`, `Form.Areas`, `PageText`) and the XAML re-renders them per page.

The hardest, least-trustworthy part of browser printing is the part this form doesn't use.

## 2. The paper original is not 1:1 either

Both printers shrink-to-fit:

```csharp
const double margin = 24;
var scale = Math.Min(1.0, (pageWidth - 2 * margin) / voucher.Width);   // voucher.Width = 780
```

`PrintableAreaWidth` for A4 portrait is ~793.7 device-independent units (210 mm at 96/inch).
So `(793.7 − 48) / 780 ≈ **0.956**` — **the WPF form already prints at about 96 %**, and on
narrower media it shrinks further. The comment says as much: "shrink-to-fit only … never up."

This resets what "exactly" means for the breaker gate. Fidelity is *the form's look* — every mark
present, in the right place, in the right flow direction and colour — not a millimetre match. That
matters because Chrome silently applies fit-to-printable-area when content exceeds the printable
region; the resulting shrink is the same order of magnitude as the one the WPF original already
performs, and is therefore not a defect. Do not chase 100 % scale.

## 3. What browser print costs, mark by mark

Judged against the actual XAML (`CollectionVoucherControl.xaml`, `AcrFormControl.xaml`):

| Form feature | Browser-print handling | Risk |
|---|---|---|
| 780 px fixed width, `Border Padding="24,16"` | fixed-width block inside `@page{size:A4;margin:0}`, own inner padding ≥ 10 mm | low |
| RTL flow (`FlowDirection="RightToLeft"` on the root Border) | `direction: rtl` on the form root | low |
| LTR islands — logo, `S.R.\|H.` box, `No.`/`Store` runs, ` Receiver Name /` | `direction: ltr` on exactly the elements the XAML overrides | low — 1:1 mapping |
| Grey cell fills `#EDEDF2` (`AmountCell`, `HeadCell`) | `print-color-adjust: exact` + `-webkit-print-color-adjust: exact` | low, one caveat → §4 |
| Red `خصم فائض` border `#C00000`, red `No.`/`Store` text | borders and text colour print regardless of the background setting | low |
| Dotted/underline fill-lines (`BorderThickness="0,0,0,1"`) | `border-block-end: 1px solid #8A8A8A` | low |
| Green POSTED banner `#EAF4EC` | same as the grey fills | low |
| Tahoma Arabic | Tahoma is a Windows system font with Arabic coverage; users are on Windows Chrome/Edge → `font-family: Tahoma, sans-serif`, no webfont | low **on Windows clients** |
| ACR 11-column table, fixed px column widths | CSS grid / table with the same px widths | low |
| Multi-page split at 22 rows, summary last page only | server-paginated blocks, `break-after: page` (§1) | low |
| Browser header/footer stamp (URL, date, title) | `@page { margin: 0 }` → no margin box, nothing stamped | **the one real risk** → §4 |

## 4. The two genuine gotchas

**a) The header/footer stamp.** There is no script or CSS that turns the checkbox off — the URL,
title, date and page number are injected by the print engine at the layout layer, outside the
document. The working lever is indirect: with `@page { margin: 0 }` there is no margin box to
stamp into, and Chromium omits them. The form then supplies its own inner padding, and that
padding must clear the printer's physical unprintable edge (~4–5 mm on most laser printers) —
≥ 10 mm is safe and is roughly what WPF's 24 DIU (6.35 mm) plus the driver's own inset produced.
Residual risk: a user who re-enables margins in the dialog gets the stamp back. **Verify on real
Chrome and real Edge during the facsimile sign-off** — this is the single thing the gate must
actually put on paper rather than reason about.

**b) `<body>` backgrounds are never printed.** Chrome and Edge both refuse to print the `<body>`
element's own background even with `print-color-adjust: exact`; the property applies to
descendants. Harmless here provided every fill lives on a descendant (the form root, the
`AmountCell`s, the `HeadCell`s) and never on `body` — but it is a trap worth writing into the
facsimile ticket.

Chrome/Edge divergence beyond this is not expected: Edge 79+ is the same Chromium print pipeline as
Chrome. `print-color-adjust` unprefixed is Chrome 92+ / Edge 79+; ship the `-webkit-` alias too.

## 5. What server PDF would actually cost

**The WPF printer logic cannot be reused. At all.** Three independent blocks:

1. Microsoft, on `System.Printing` — *"Classes within the System.Printing namespace are not
   supported for use within a Windows service or ASP.NET application or service. Attempting to use
   these classes from within one of these application types may produce unexpected problems, such
   as diminished service performance and run-time exceptions."* Both printers are built on
   `PrintDialog` / `LocalPrintServer` / `PrintQueue`.
2. `SIS.Api.csproj` targets **`net8.0`**, not `net8.0-windows`, and has no `UseWPF`. WPF types are
   not reachable without retargeting the web host to a Windows-only desktop framework.
3. SIS.Api references `Sartawi.Retail.Data` — where `CollectionVoucherBuilder` and `AcrFormBuilder`
   live — but **never `Sartawi.Retail`**, where the two `UserControl`s live. The *brains* are
   already server-side and reachable, which is what the map's "builders move server-side" decision
   rests on. The *rendering* is not, and was never going to be.

So server PDF means writing a **third** rendering of each form and keeping it in sync with the WPF
one and the React one — precisely the drift the map's settled decisions were designed to prevent.

SIS.Api today carries **zero** PDF/reporting packages (no QuestPDF, iText, Aspose, Syncfusion,
wkhtmltopdf, Stimulsoft — the whole solution's only near-miss is a Serilog enricher). Both credible
paths are new infrastructure:

- **QuestPDF** — real RTL/bidi support and active (2026.7.x), but the layout is a C# fluent DSL:
  every border, fill, column width and LTR island hand-ported, with no visual relationship to the
  XAML it must match. And the free Community licence stops at **$1M annual revenue** — al-Dawaa is
  far past it, so this is a **commercial licence purchase**, i.e. a procurement conversation before
  a line of code.
- **PuppeteerSharp / headless Chromium** — no licence problem and no re-authoring, because it
  *renders the same HTML*. Cost is operational: a Chromium binary shipped and lifecycle-managed
  next to SIS.Api on IIS, a recurring Chromium-CVE patching obligation, a memory baseline shift,
  and a concurrency story (spawn-per-request collapses under load; you need a page pool).

Note what the second bullet means for sequencing: **the headless path consumes the browser-print
artifact.** You cannot reach it without first building the HTML facsimile. There is no ordering in
which starting with PDF saves work.

The on-screen view question resolves itself the same way: with browser print, screen and paper are
the *same component and the same CSS* (screen media just shows the page blocks stacked with a grey
gutter, like a PDF viewer), so they cannot diverge. With server PDF you either embed a PDF viewer
in the screen — losing the React view entirely — or maintain a React view that is a second
rendering of the artifact that actually prints, and watch it drift.

## 6. Recommendation, and what would trigger the PDF effort

**Build browser print now.** One design constraint carries the option value: render each document
on its **own dedicated print route** whose entire body *is* the document — no AppShell, no nav, no
AG Grid, nothing hidden by `@media print`. (Hiding an AG Grid behind a print stylesheet is exactly
the kind of thing that breaks quietly.) A self-contained route is both the honest way to get a
clean sheet of paper *and* the exact input a headless Chromium would need later.

Open the PDF effort when any of these becomes true:

1. **The gate fails on real hardware** — Chrome and Edge visibly disagree on the same page, or the
   header/footer stamp cannot be reliably suppressed on the users' actual machines.
2. **The document must be stored or sent** — archived against the collection record, emailed to
   the accountant, attached to anything. A browser print produces no file; a stored artifact needs
   one.
3. **Unattended printing is required** — the WPF path prints silently to `POSMachine.PrinterName`.
   The web cannot; if a supervisor needs queued or silent printing, that is a server artifact plus
   a spooler, not a browser.
4. **A non-Windows client becomes a real user** — a tablet without Tahoma breaks the type story
   that §3 leans on.

If it opens, take **headless Chromium over QuestPDF**: same HTML, no re-authoring, no licence
purchase, and the drift risk stays at zero. QuestPDF only wins if the operational cost of shipping
Chromium is judged unacceptable — and that trade is worth re-running at the time, not now.

---

### Sources

- [System.Printing Namespace — Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/api/system.printing) (the service/ASP.NET caution)
- [print-color-adjust — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/print-color-adjust)
- [Cross-browser support of CSS print-color-adjust — LambdaTest](https://www.lambdatest.com/web-technologies/css-color-adjust)
- [Remove the header, footer & URL when printing — bobbyhadz](https://bobbyhadz.com/blog/javascript-remove-header-footer-url-from-print)
- [Add content to the margins of printed web pages — Chrome for Developers](https://developer.chrome.com/blog/print-margins)
- [How to print at actual size (100 % scale) — PrintReadyKit](https://printreadykit.com/printing-guides/how-to-print-actual-size) (Chrome's silent fit-to-printable-area)
- [QuestPDF on NuGet (2026.7.2)](https://www.nuget.org/packages/QuestPDF/) and [bidirectional text support #445](https://github.com/QuestPDF/QuestPDF/issues/445)
- [PuppeteerSharp C# PDF: the hidden ops cost (2026)](https://hackernoon.com/puppeteersharp-c-pdf-the-hidden-ops-cost-2026-guide) · [puppeteer-sharp](https://github.com/hardkoded/puppeteer-sharp)
- Local: `CollectionVoucherPrinter.cs`, `AcrFormPrinter.cs`, `AcrFormBuilder.cs:201`,
  `CollectionVoucherControl.xaml`, `AcrFormControl.xaml`, `Services/SIS.Api/SIS.Api.csproj`
