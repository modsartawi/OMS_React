---
status: open
spec: 249
blocked-by: 251
---

# 252 — An ACR form prints across its pages

## What to build

`/collection/acr/:acrId` renders the نموذج متابعة المبيعات النقدية ومبيعات الشبكة on the same
dedicated print route shape [251](251-a-collection-receipt-prints-as-one-a4-sheet.md) established,
reusing its sheet primitives, print stylesheet and `Ltr` islands rather than inventing a second
answer.

Blocked by 251 deliberately — that ticket settles the shared vocabulary (type, colours, print setup,
how an RTL facsimile is built as production code in this repo) and this one consumes it.

**⚠ Recover from branch `prototype/247-acr-form`** (`03a2d72`) — `acr-mock.ts`, `Sheet.tsx`,
`VariantC.tsx`, `logo-aldawaa.png`, `paper-acr-original.png`. **Recover the fixture and assets;
rewrite the component.**

**The ACR is a reshape, not a facsimile** — the WPF redrew this form rather than copying it, so
"matches the WPF" and "matches the paper" are genuinely different tests here. The rule both sign-offs
applied, and the one to carry forward for any question this ticket does not answer: *where the WPF
departed from the paper because it knows something the blank pad could not, keep the departure; where
it departed by accident or omission, go back to the pad.*

**The marks, as signed off** ([247](247-the-acr-form-across-its-pages.md); inventory §4, §5, §7):

- Logo top-right at 42px, centred title, **`صفحة n / m` stamp top-left** — the pad was one sheet,
  this prints three.
- Both meta strips, including the **blank `تاريخ التحصيل` of a still-OPEN ACR**.
- **`رقم التجميعي`**, not `نموذج رقم ( )` — it is the ACR's own serial, not a form-stock number, and
  the parentheses bracketed a blank a collector wrote into.
- **`الموافق` restored** beside the Gregorian date — dropped by the WPF through omission.
- The eleven-column table at its exact widths, header cells grey-filled, borders collapsing as the
  WPF `Cell`/`HeadCell` styles collapse them. `overflow-wrap: break-word`, **not `anywhere`** —
  `anywhere` shears `مطابقة الكاش والشبكة` into four lines with a lone `ة`.
- Meta labels keep their **trailing space** (`white-space: pre`) — the XAML carries it and HTML
  collapses it; a porting artifact, not a design choice.
- **The header row repeats on every page** and the `م` sequence runs **unbroken** across pages.
- **`رقم الصيدلي`** over the closer's id — the closer *is* the pharmacist, so the column says so and
  pairs with `اسم الصيدلي` beside it.
- The per-row `مطابقة` flag in all three states — blank, red `✗`, and `؟` (the Z mirror never synced,
  paired with `تقرير Z غير مُرحّل` in the notes column).
- **A negative figure is an LTR island** — `-412.50`, never `412.50-`. The minus is bidi-neutral and
  otherwise resolves to the RTL paragraph direction. ⚠ **The WPF has this same bug**, and the fidelity
  inventory's §1.1 list of required LTR islands was one short.
- A shortfall row carries the **mismatch-red warning style**.
- **Last page only**: the `الاجمالي` band, the `ملخص التحصيل` box and the collector name/id with the
  empty wet-signature line. **`ملخص التحصيل` on the left, signature on the right** — the pad's sides;
  the WPF swapped them for no stated reason.
- `ملخص التحصيل` carries **one row, `اجمالي الايرادات`**. Every deposit mark is gone, meta *and*
  summary: the ACR states what was collected; where the money went afterwards is the deposit's own
  document.
- Per-row `تاريخ اليوم` **kept** — a catch-up ACR carries more than one sales day and a single header
  date cannot say which row is which.
- **Stay dropped**: the pad's 18 pre-ruled rows, the three difference rows, `سبب الفرق`, and both
  instruction blocks. Ruled lines and standing procedure exist for a pad being filled in, not a record
  being read.

**Pagination is the server's arithmetic and the client never applies it.** `rowsPerPage: 22` rides on
the contract as documentation of the break rule. One 210×297mm block per model page with
`break-after: page` means the browser never chooses a break — which is exactly what
[241](241-what-a-browser-can-print-a-paper-form-with.md) ruled and why browser print was viable at all.

The contract, from [245 §4](245-the-shape-of-a-print-ready-document.md) — **header hoisted**, because
every page references the same form and a naive list repeats the header *and all rows* per page:

```ts
type AcrRow = {
  seqText: string          // 1-based, CONTINUOUS across pages
  storeCode: string; salesDateText: string
  cashText: string; cardText: string; totalText: string
  receiptNoText: string    // NOT zero-padded, unlike the receipt's own No.
  matchText: '' | '✗' | '؟'
  pharmacistName: string; pharmacistId: string
  notes: string            // Arabic; '' when there is nothing to say
  isShortfall: boolean
}
type AcrPage = { pageIndex: number; pageCount: number; pageText: string; showSummary: boolean; rows: AcrRow[] }
type AcrForm = {
  acrDateText: string; hijriText: string; acrNumberText: string; areas: string
  closedAtText: string     // '' while the ACR is still OPEN
  label: string; status: string; collectorName: string; collectorId: string
  cashTotalText: string; cardTotalText: string; grandTotalText: string
  revenuesText: string     // ملخص التحصيل's ONE remaining row
}
```

## Spine reach

fixture (model) · component · route · print stylesheet · lint-gate config · test

## Proof (→ `tdd` red-green cycles)

- [ ] `tools/collection-print-drive.mjs` extended — the fixture's **four paging scenarios**, each
      asserted: **47 rows** → 3 pages, header repeated on each, `م` running 1→47 unbroken, summary on
      page 3 only; **25 rows** → a short last page; **23 rows** → ⚠ the worst case, **one row alone on
      the last page beneath the whole summary block**, which must stay legible and put the summary
      where the paper puts it; **0 rows** → the idle ACR still prints its one page with totals `0.00`
      and the summary present · flow (Playwright)
- [ ] `tools/collection-print-drive.mjs` — a **negative** cash figure renders `-412.50` and not
      `412.50-`, asserted on the rendered text, since this is a bug the WPF has and the inventory
      missed · flow (Playwright)
- [ ] `tools/collection-print-drive.mjs` — an ACR with `closedAtText: ''` renders a **blank**
      `تاريخ التحصيل` rather than the string `''` or a placeholder · flow (Playwright)
- [ ] `npm run lint` passes with the ACR facsimile files added to `COLOUR_SOURCES` — ⚠ verified
      load-bearing: without the exclusion the four files trip **22** violations · flow (lint gate)

Again no renderer unit tests — nothing here is computed client-side.

## Boundaries

- **No API.** Fixture only.
- Inherits 251's three-rule documented exception; adds this document's files to `COLOUR_SOURCES`
  (`#EDEDF2`, `#8A8A8A`, `#B00020`).
- Route outside the AppShell, as 251.
- **`rowsPerPage` is documentation, not an instruction** — a reviewer should be able to grep the
  client for chunking logic and find none.

## Done when

`/collection/acr/:acrId` renders the signed-off form; all four paging scenarios print correctly with
the header repeating and the sequence unbroken; a negative figure reads left-to-right; the drive is
green; `typecheck` and `lint` are clean.

## Blocked by

[251](251-a-collection-receipt-prints-as-one-a4-sheet.md) — shares the sheet primitives, the print
stylesheet and the palette-exclusion pattern.

## Open questions

- **The logo — the same single open item 251 carries**, and on this document it is sharper: the paper
  original prints **DMSCO** while the WPF prints al-dawaa. Render the stacked al-dawaa as the interim
  (the prototype's variant B drew a labelled placeholder rather than faking the DMSCO mark, which is
  the honest fallback if the interim is rejected). **One decision, both documents, needs an asset from
  the brand side.** Tracked on the WPF side as BackOffice ticket 1088, which records it as blocked for
  the same reason.
