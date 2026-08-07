---
type: wayfinder-ticket
wayfinder: prototype
map: 240
status: open
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
