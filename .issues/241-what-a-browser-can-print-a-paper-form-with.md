---
type: wayfinder-ticket
wayfinder: research
map: 240
status: done
blocked-by: —
---

# 241 — What a browser can print a paper form with

## Question

The breaker is a facsimile that comes out of a printer looking like the paper form. Two candidate
paths, and the user explicitly asked for research rather than a guess:

1. **Browser print** — the React facsimile is styled for A4 with `@page`, print media queries, and
   explicit page-break control; the user hits Print.
2. **Server-rendered PDF** — SIS.Api renders the voucher/ACR to PDF and the browser downloads it.

Answer, with evidence, for *this* document specifically — not print-CSS in general. The form is
780px fixed-width, RTL flow with LTR islands (the logo, the `S.R.|H.` amount boxes, the `No.` and
`Store` runs), Arabic Tahoma type, bordered digit cells and dotted fill-lines, and — for the ACR —
a multi-page table where the summary + signature block appears on the last page only and the WPF
pager splits at 22 rows.

Settle:

- **Can browser print hold the fidelity?** Fixed-width mm/A4 sizing, `print-color-adjust` for the
  grey box fills and the red `خصم فائض` border, `break-inside: avoid` on rows, headers repeating
  across ACR pages, and how much the result varies between Chrome and Edge (the users' actual
  browsers). Include the margin/header-footer problem — browsers stamp URL and date unless the
  user unticks it, which a facsimile cannot tolerate.
- **What server PDF would cost.** What renderer is available to a .NET 8/9 SIS.Api, whether the
  existing WPF `CollectionVoucherPrinter` / `AcrFormPrinter` logic can be reused headlessly at all,
  and what the on-screen view then becomes (a PDF embed, or a React view that risks diverging from
  the artifact that actually prints).
- **Whether pagination is the deciding factor.** If the ACR's page-splitting has to be exact and
  browser page-breaks can't be trusted, the model arrives pre-paginated from the server (already the
  plan) and each page becomes a fixed-height block — which may make browser print viable after all.

Recommend one. If the answer is "browser print now, PDF as a later effort", say what would trigger
the later effort.

Capture the findings as a `/research` markdown asset under `.issues/assets/` and link it here.

## Answer

**Browser print.** A dedicated print route, `@page { size: A4; margin: 0 }`, one fixed-size block
per server-paginated model page, `window.print()`. Full evidence and the mark-by-mark table:
[241-print-path.RESEARCH.md](assets/241-print-path.RESEARCH.md).

**Pagination was the deciding factor, and it decides for the browser.** Neither WPF printer ever
asks a layout engine where to break — `BuildDocument` loops one `FixedPage` per model page, and
`AcrFormBuilder.Paginate(form, rowsPerPage: 22)` is pure arithmetic with `ShowSummary` on the last
chunk. The map already has the model arriving pre-paginated, so the browser inherits the same job:
render N blocks with `break-after: page`. The least trustworthy part of browser printing is the
part this form doesn't use — no reflow breaks, no `break-inside` heuristics, no repeating table
header (each `AcrFormPage` already carries its own header fields).

**"Exactly" is looser than it reads.** Both printers shrink-to-fit —
`scale = min(1.0, (pageWidth − 48) / 780)`, which on A4 portrait is ≈ **0.956**. The paper original
already prints at ~96 %, so Chrome's silent fit-to-printable-area shrink is the same order of
magnitude and is not a defect. Fidelity at the gate means every mark present, positioned, flowed
and coloured correctly — not a millimetre match. Don't chase 100 % scale.

**Two real gotchas, both for the sign-off gate to put on actual paper:**

1. *The header/footer stamp.* No script or CSS turns it off — it's injected outside the document.
   The lever is `@page { margin: 0 }`: no margin box, nothing to stamp into. The form then needs
   its own inner padding ≥ 10 mm to clear the printer's unprintable edge. A user who re-enables
   margins in the dialog gets the stamp back, so this must be **verified on real Chrome and real
   Edge**, not reasoned about.
2. *`<body>` backgrounds are never printed* by Chrome or Edge, even with `print-color-adjust:
   exact` — it applies to descendants only. Every fill (`#EDEDF2` cells, the green POSTED banner)
   must live on a descendant, never on `body`. Ship both the unprefixed property and `-webkit-`.

**Server PDF cannot reuse the WPF printers, at all.** Microsoft: *"Classes within the
System.Printing namespace are not supported for use within a Windows service or ASP.NET application
or service."* `SIS.Api.csproj` targets plain `net8.0` (not `-windows`, no `UseWPF`), and references
`Sartawi.Retail.Data` — where the builders live — but never `Sartawi.Retail`, where the two
`UserControl`s live. The brains are already server-reachable; the rendering never was. PDF means a
**third** rendering of each form to keep in sync with the WPF and React ones — the exact drift the
map's settled decisions exist to prevent. SIS.Api carries zero PDF/reporting packages today.

**And the credible PDF path consumes this one.** QuestPDF means hand-porting the layout into a C#
fluent DSL with no visual relationship to the XAML, plus a commercial licence (Community stops at
$1M revenue). PuppeteerSharp/headless Chromium needs no re-authoring **because it renders the same
HTML** — so you must build the browser facsimile first regardless. There is no ordering in which
starting with PDF saves work. Browser print also keeps screen and paper as one component and one
stylesheet, so they cannot diverge; a PDF path forces either an embedded viewer or a second React
rendering that drifts.

**Design constraint this places on the build** (for the facsimile and contract tickets): each
document renders on its **own dedicated print route** whose entire body *is* the document — no
AppShell, no nav, no AG Grid hidden behind `@media print`. That is both the honest way to a clean
sheet and the exact input a headless Chromium would need later.

**Triggers for the later PDF effort:** the gate failing on real hardware (Chrome/Edge visibly
disagreeing, or the stamp not suppressible on the users' machines); a need to **store or send** the
document (archive against the collection record, email the accountant — a browser print is not a
file); **unattended/silent** printing, the way WPF prints to `POSMachine.PrinterName`; or a
non-Windows client becoming a real user, which breaks the Tahoma-is-a-system-font assumption. If it
opens, take headless Chromium over QuestPDF — same HTML, no licence, zero drift.

**Fold-in:** this settles the map's *Arabic type story* fog for the chosen path — Tahoma is a
Windows system font with Arabic coverage and the users are on Windows Chrome/Edge, so
`font-family: Tahoma, sans-serif` matches the WPF metrics with no webfont. Confirming that on paper
belongs to the two facsimile gates, not to a ticket of its own.
