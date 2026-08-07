---
type: wayfinder-ticket
wayfinder: prototype
map: 240
status: done
blocked-by: 242, 246
---

# 247 — The ACR form, across its pages

## Question

**The breaker's second gate.** Build the ACR — نموذج متابعة المبيعات النقدية ومبيعات الشبكة
بالصيدليات — as a throwaway React facsimile and get side-by-side sign-off against the WPF original.

Blocked on the receipt prototype (246) deliberately: that ticket settles the shared vocabulary —
type, colours, print setup, how an RTL facsimile is built in this codebase — and this one reuses it
rather than inventing a second answer.

Use `/prototype`, hard-coded values from the fidelity inventory (242), enough rows to force
**at least three pages** so pagination is genuinely exercised.

What it must reproduce, per 242:

- 780px, RTL, the logo top-right at 42px, the centred title, the `صفحة {0}` stamp top-left.
- Both meta strips — `عن يوم` / `نموذج رقم ( )` / `المنطقة`, then `تاريخ التحصيل` / `الوصف` /
  `الحالة` — including the blank `تاريخ التحصيل` of a still-OPEN ACR.
- The eleven-column table at its exact widths, header cells grey-filled, borders collapsing the way
  the WPF `Cell` / `HeadCell` styles collapse them, and the `م / رقم الصيدلية / تاريخ اليوم / …`
  header row **repeated on every page**.
- Rows: bold total, the per-row `مطابقة` flag in all three states (blank, red `✗`, `؟`), the
  operator-id column, the small-type notes column.
- **Last page only**: the `الاجمالي` band, the `ملخص التحصيل` box (اجمالي الايرادات + the bold
  اجمالي ايداع المحصل), and the collector name/id plus the empty wet-signature line.

Then run the comparison against the WPF `AcrFormWindow` output (or the paper scan
`Scanned Document 4.pdf`) with the user, on screen and on paper as 241 requires — paying particular
attention to where the pages break and whether the last-page block lands where the paper puts it.

**Input from 242:** the inventory is
[`assets/242-fidelity-inventory.RESEARCH.md`](assets/242-fidelity-inventory.RESEARCH.md) — build
from its §4, §5 and §7; the paper original is rendered beside it as
[`assets/242-acr-paper-original.png`](assets/242-acr-paper-original.png) (the source PDF is a
text-less scan). Note §6.2: the WPF **reshaped** this form rather than copying it, so "matches the
WPF" and "matches the paper" are different tests here — §8 carries the resulting agenda: O5
(`Z report missing`, a raw English literal in an Arabic form), O6 (`IsShortfall` built but unbound),
O7 (`DepositNumber`/`DepositStatus` unbound), **O8 (the paper's logo is DMSCO, the WPF prints
al-dawaa — the largest, brand-facing divergence)**, O9 (`الموافق`, the 18 pre-ruled rows, the three
difference rows + `سبب الفرق`, and both instruction blocks — all dropped by the WPF).

Resolves only on explicit sign-off. Record the sign-off, every discrepancy and its disposition, and
anything pagination taught that 245's contract must absorb. Link the prototype.

## Answer

**Signed off — variant C, with three amendments, all applied.** *"c is good, 2 notes … also one more
thing."* **Breaker gate 2 is passed**, and with 246 the map's breaker is now clear on both documents.

**The prototype:** `src/features/oms/collection/__prototype__/acr/` — three readings on
`/prototype/acr-form?variant=A|B|C&state=…`, each paginated onto real A4 sides on 241's geometry,
the paper scan pinned beside them. **Throwaway, captured off main** (`.claude/skills/prototype`
step 6) on branch **`prototype/247-acr-form`** (`03a2d72`), which also carries the route entry and
the `check-palette.mjs` exclusion. Main keeps only this decision.

```
git checkout prototype/247-acr-form
npx vite --port 5199    # → /prototype/acr-form?variant=C
```

The build wave **rewrites** the winner rather than promoting it — inline styles standing in for the
XAML setters, a hard-coded model, no tests. What C settles is every mark's ruling.

### What C settled

246's rule survives contact with a **reshape**: *keep the departure the WPF made because it knows
something the pad could not; go back to the pad where it departed by accident or omission.* Applied
to §8-O9's dropped furniture, the split is —

| Paper furniture | Ruling |
|---|---|
| `تاريخ اليوم` inserted per row | **Keep the WPF's.** A catch-up ACR carries more than one sales day; the pad's single header date cannot say which row is which. |
| `توقيع الصيدلي` → the closer's id | **Keep the WPF's**, and see amendment 1. A wet-signature column is a hand-fill slot on a printed record — 246's `Store. {code}` ruling again. |
| 18 pre-ruled rows | **Keep dropped.** Ruled lines exist to be written on. |
| three difference rows + `سبب الفرق` | **Keep dropped** — the only paper furniture the WPF dropped for a *stated* reason (the difference lives on the Z record). |
| `تعليمات عامه` / `خطوات مراجعة الصيدلي` | **Keep dropped.** Standing procedure for a pad being filled in, not for a record being read. |
| `الموافق` (Hijri companion date) | **Restored.** Dropped by omission; the server can compute Umm al-Qura (242 §7.6 already pins the culture), so it costs one model field, not a hand-fill. |
| `ملخص التحصيل` left / signature right | **Restored to the pad's sides.** The WPF swapped the two for no stated reason. |
| `صفحة n / m` stamp | **Keep the WPF's.** The pad was one sheet; this prints three. |

And the loose ends: **O5** the notes column speaks Arabic (`تقرير Z غير مُرحّل`) — the literal is
*ours*, so the fix belongs in `AcrFormBuilder`, not in a pass-through excuse. **O6** `IsShortfall`
earns its warning style: a negative cash figure prints in the mismatch red. **O7** answered by
amendment 3 below. **O8** answered by amendment 1's sibling — see *still open*.

### The three amendments — and all three reach the model

1. **`رقم المشغل` → `رقم الصيدلي`.** The closer *is* the pharmacist, so the column says so and pairs
   with `اسم الصيدلي` beside it. 245's field is **`pharmacistId`**, not `operatorId`.
2. **`نموذج رقم ( )` → `رقم التجميعي`.** The field is the ACR's own serial, not a form-stock number.
   The pad's parentheses went with it — they bracket a blank a collector wrote into.
3. **Every deposit mark removed** — `رقم الإيداع` from the meta strip **and** `اجمالي ايداع المحصل`
   from the summary. **242 §8-O7 is answered OUT, and wider than it was asked**: the ACR states what
   was *collected*; where the money went afterwards is the deposit's own document. So
   `DepositNumber`, `DepositStatus` **and `DepositText`** all leave 245's model, and `ملخص التحصيل`
   is left holding a single row, `اجمالي الايرادات`.

**⚠ For ticket 245**, alongside 246's own shrinkage: the ACR's print-ready model is
`AcrFormBuilder`'s output **minus all three deposit fields**, with `OperatorId` renamed, plus one
new field — the Hijri `الموافق` date, pre-formatted server-side like every other string on this
form. `MatchText` stays a real per-row output (`CashRounding.Reconcile` still runs per row).

### What pagination taught

- **The page break is arithmetic, and it holds.** `paginate(rows, 22)` mirrors
  `AcrFormBuilder.Paginate`; one 210×297mm block per model page with `break-after: page` means the
  browser never chooses a break. Verified at 47 rows (3 pages), 25 (short last page), 23 (**one row
  alone on page 2 with the whole summary beneath it** — legible, and the summary lands where the
  paper puts it), and 0 (the idle ACR still prints its one page, totals `0.00`, summary present).
- **The header row must repeat**, and does — each page is a fresh control, exactly as the WPF's
  `FixedPage`-per-chunk printer builds it. The `م` sequence runs 1→47 unbroken across pages.
- **A page of 22 rows fills ~60 % of A4.** There is headroom to raise `rowsPerPage` later; leaving it
  at 22 is what keeps the web and WPF sheets identical, which is the whole point.

### Discrepancies found, and their disposition

| Found | Disposition |
|---|---|
| A negative figure renders **`412.50-`** — the minus is bidi-neutral and resolves to the RTL paragraph direction. **The WPF does the same thing.** | **Fixed in C**: money cells are LTR islands. 242 §1.1 listed the LTR islands both documents need and this was not among them — the inventory's list was one short. |
| The XAML's meta labels carry a **trailing space** (`'عن يوم: '`) which HTML collapses | **Fixed** — `white-space: pre` on the label. A porting artifact, not a design choice. |
| `overflow-wrap: anywhere` shears `مطابقة الكاش والشبكة` into four lines with a lone `ة` | **Fixed** — `break-word`. WPF's `TextWrapping="Wrap"` breaks at word boundaries. |
| The colour-literal gate fires on the facsimile (`#EDEDF2`, `#8A8A8A`, `#B00020`) | **Fixed** — whole-file exclusion in `tools/check-palette.mjs`, the same permission 246 took. Verified it is load-bearing: without it the four files trip 22 violations. |
| The paper's instruction blocks have **no text layer** in the source PDF | Transcribed **by eye** into variant B. Only matters if the blocks are ever restored — C drops them. |

### Still open, and not this ticket's to close

- **O8 — the logo, still unresolved, and now overdue.** The paper prints **DMSCO**, the WPF prints
  al-dawaa, and 246 found the receipt wants a *horizontal* al-dawaa lockup that exists in neither
  repo. C renders the stacked al-dawaa the WPF ships; variant B draws a labelled placeholder rather
  than faking the DMSCO mark. **One decision, both documents, and it needs an asset from the brand
  side before either facsimile is truly finished.** It blocks nothing on this map — it is a file.
- **The printer.** 241's two gotchas (the header/footer stamp, the background fills) are hardware
  questions and have still never met a printer, on either document. Belongs to the build wave's
  proof, on real Chrome **and** real Edge, on paper.

## Comments

**From 246 (2026-08-07) — two things this gate inherits.**

1. **The rule that settled the receipt**, offered as the ACR's starting posture rather than a
   ruling: *where the WPF departed from the paper because it knows something the pad could not,
   keep the departure; where it departed by accident or omission, go back to the paper.* Note the
   ACR is a **reshape, not a facsimile** (242's finding), so it has far more departures to sort —
   §8-O9's dropped furniture is where that rule gets its real test.
2. **The logo is one decision shared with the receipt, and it is unresolved.** 246 found that the
   WPF ships the *stacked* `logo-aldawaa.png` while the pad carries the *horizontal* lockup with
   `care for life / نهتم بالحياة` — an asset neither repo holds. That sits underneath §8-O8
   (paper prints **DMSCO**, WPF prints al-dawaa): settle *which mark* and *which lockup* together.

Also inherited: the facsimile is exempt from the **colour-literal** lint gate as well as
i18n-zero-literal and logical-tailwind — whole-file exclusion in `tools/check-palette.mjs`.
