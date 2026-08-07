---
type: wayfinder-ticket
wayfinder: research
map: 240
status: done
blocked-by: —
---

# 242 — Every mark on both forms, written down

## Question

The breaker cannot be judged against a vague memory of the paper. Produce the **fidelity
inventory** — the checklist the two side-by-side sign-offs will be run against, and the thing a
builder implements from.

For **each** of the two documents, extract from the XAML (and reconcile against the paper scans the
XAML comments name) a complete, ordered inventory:

- Receipt — `Sartawi.Retail\Collection\Voucher\CollectionVoucherControl.xaml`, paper reference
  `Sartawi.POS\NewPos\Shifts\Images\Collection Receipt.jpg`
- ACR — `Sartawi.Retail\OMS\AcrInquiry\AcrFormControl.xaml`, paper reference
  `Sartawi.POS\NewPos\Shifts\Images\Scanned Document 4.pdf`

Each entry records: the literal text (Arabic and English exactly as written, including the spacing
inside `سـنـد قـبـض` and the trailing spaces in labels like `"استلمت أنا/ "`), its position in the
layout, its flow direction (the forms are RTL with deliberate LTR islands), its type treatment
(size, weight, underline, colour — `#C00000` red, `#1A1A1A` ink, `#8A8A8A` line, `#EDEDF2` box
fill), its box/border/fill treatment, and — for a value — which model field feeds it and how it is
formatted.

Also settle the **conditional** marks, which are where a facsimile silently goes wrong:

- The green `تم الترحيل — POSTED` banner and when it shows.
- `VarianceText` + `MatchedMarkText` in the red `خصم فائض` box — including the مطابق case.
- ACR `MatchText` per row: blank / `✗` / `؟` and what each means.
- The ACR summary + signature block appearing on the **last page only**, and the `صفحة {0}` stamp.
- Empty/absent values — what a blank fill-line looks like versus a zero.

Read `CollectionVoucherBuilder.cs` and `AcrFormBuilder.cs` (and their tests in `Tests\Data.Tests\`)
for the formatting rules behind every computed string — SAR 2dp vs BHD 3dp, the whole/minor split
feeding the digit cells, Arabic amount-in-words, the 22-rows-per-page split, `ShiftDay` rendered as
an `ar-SA` weekday name. The inventory names the rule; it does not reimplement it.

Deliver as a markdown asset under `.issues/assets/` and link it here. It is referenced by both
facsimile prototype tickets and by the model-contract ticket.

## Answer

The inventory is **[`assets/242-fidelity-inventory.RESEARCH.md`](assets/242-fidelity-inventory.RESEARCH.md)**
— both documents, mark by mark, with the rule behind every computed string. Companion asset:
**[`assets/242-acr-paper-original.png`](assets/242-acr-paper-original.png)**, a render of the ACR
paper scan (`Scanned Document 4.pdf` is a text-less scan; rendering it needed a PDF toolchain, so
the image is checked in and later tickets need none).

Both paper originals were read and reconciled, not just the XAML. What the inventory holds:

- **§1** the shared foundations — 780 px, Tahoma, RTL, the exact palette, the LTR islands, and the
  WPF print geometry (24-unit margin, shrink-to-fit-only `min(1, (W−48)/780)`).
- **§2–§3** the receipt: ten bands, every literal verbatim (tatweel in `سـنـد قـبـض`, trailing
  spaces, the two-space runs in `S.R.  ريال`), every colour, box and fill-line, the field behind
  each value, and the conditional table — POSTED, `—` for an unassigned `No.`, `فائض`/`عجز`, the
  `مطابق` case, negatives, empty-vs-zero, 3dp currencies.
- **§4–§5** the ACR: the eleven columns at their exact widths, the border-collapse pattern, the
  tri-state `MatchText` (blank / `✗` / `؟`), the last-page-only summary + signature, the
  `صفحة {n} / {m}` stamp, and the empty-ACR-still-prints-one-page rule.
- **§6** paper ↔ WPF reconciliation for both.
- **§7** every formatting rule named, with its pinned test values: the digit split, the 10-digit
  `No.`, variance text, `CashRounding`, tafqeet, the dates, ACR money/dates, the 22-row split.

**Two findings worth surfacing above the inventory:**

1. **The ACR is a reshape, not a facsimile.** The paper form carries a **DMSCO** logo (the WPF
   prints al-dawaa), an `الموافق` Hijri companion date, **18 pre-ruled rows**, a `توقيع الصيدلي`
   signature column (the WPF prints `رقم المشغل` instead), a **five-row** `ملخص التحصيل` with a
   `سبب الفرق` box, and two prose instruction blocks — all dropped or replaced by the WPF, which
   also *adds* a `تاريخ اليوم` column. So for this document "matches the WPF" and "matches the
   paper" are **different tests**, and the map's breaker has to say which one it means. The receipt,
   by contrast, is a close facsimile with only deliberate, small deviations.
2. **`مطابق` can never render on the path the web will use.** `FromInquiryRow` — the HQ route —
   copies `Variance` but leaves `CashRoundingMatched`/`Absorbed` false, so the green mark is a
   POS-only artifact today.

**§8 lists nine open questions** (O1–O9) — each a place where the XAML, the paper and the intended
web output disagree. They are deliberately left unresolved: they are the agenda for the sign-offs
and the contract. Wired into the tickets that own them — O1–O4 → **246**, O5–O9 → **247**,
O4–O7 + the `ar-SA`/Hijri weekday → **245**.

No new tickets and no fog graduated: everything this surfaced belongs to tickets that already exist.
