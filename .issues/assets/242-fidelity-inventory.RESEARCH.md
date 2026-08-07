# 242 — Fidelity inventory: سند قبض receipt + ACR follow-up form

The checklist the two side-by-side sign-offs (tickets 246, 247) are run against, and the thing a
builder implements from. Every mark on both documents: literal text, position, flow direction, type
treatment, box treatment, and — for a value — the model field behind it and the rule that formats it.

**This document names rules; it does not reimplement them.** The formatting rules live server-side in
`Sartawi.Retail.Data\Modules\Pos\Services\Voucher\` and are pinned by tests. The web renders a
print-ready model (map 240's settled decision), so §7 is the contract of *what must already be a
string* by the time it reaches the browser.

## Sources read

| What | Path (under `C:\Work\DMSCO\BackOffice\`) |
|---|---|
| Receipt facsimile | `Sartawi.Retail\Collection\Voucher\CollectionVoucherControl.xaml` |
| Receipt pager / printer | `…\Voucher\CollectionVoucherPager.xaml`, `CollectionVoucherPrinter.cs` |
| ACR facsimile | `Sartawi.Retail\OMS\AcrInquiry\AcrFormControl.xaml` |
| ACR printer | `Sartawi.Retail\OMS\AcrInquiry\AcrFormPrinter.cs` |
| Receipt brains | `Sartawi.Retail.Data\Modules\Pos\Services\Voucher\CollectionVoucherBuilder.cs`, `CollectionVoucherModel.cs`, `CollectionVoucherFormat.cs`, `ArabicTafqeet.cs` (also holds `NounForms` + `VoucherCurrency`) |
| ACR brains | `…\Voucher\AcrFormBuilder.cs` (holds `AcrForm`, `AcrFormRow`, `AcrFormPage`) |
| Shared rule | `Sartawi.Retail.Data\Modules\Pos\Services\CashRounding.cs` |
| Tests | `Tests\Data.Tests\` — `CollectionVoucherFormatTests`, `ArabicTafqeetTests`, `CashRoundingTests`, `CollectionVoucherBuilderTests`, `CollectionVoucherModelTests`, `AcrFormBuilderTests` |
| Paper — receipt | `Sartawi.POS\NewPos\Shifts\Images\Collection Receipt.jpg` (read directly) |
| Paper — ACR | `Sartawi.POS\NewPos\Shifts\Images\Scanned Document 4.pdf` — a pure scan, no text layer; rendered to [`242-acr-paper-original.png`](242-acr-paper-original.png) beside this file so later tickets need no PDF toolchain |

---

## 1. Shared foundations

Both documents are **one 780-px-wide fixed column**, white, Tahoma, RTL flow, wrapped in a 1-px
`#8A8A8A` border.

| | Receipt | ACR |
|---|---|---|
| `Width` | 780 | 780 |
| Base `FontFamily` | Tahoma | Tahoma |
| Base `FontSize` | 12 | 11 |
| Outer `Border` padding | `24,16` | `20,14` |
| Outer border | 1 px `#8A8A8A` | 1 px `#8A8A8A` |
| Root `FlowDirection` | RightToLeft | RightToLeft |
| Pagination | one page **per shift** | one page per **22 rows** |

**Palette (both, identical keys):**

| Token | Value | Used for |
|---|---|---|
| `VoucherRed` | `#C00000` | receipt only — `خصم فائض` label + its box border, `Store.`, `No.` |
| `VoucherInk` / `FormInk` | `#1A1A1A` | body text, amount-cell borders |
| `VoucherLine` / `FormLine` | `#8A8A8A` | outer border, fill-lines, ACR table gridlines |
| `VoucherBoxFill` / `FormHead` | `#EDEDF2` | receipt amount cells; ACR header cells + `الاجمالي`/`ملخص` label cells |
| — | `#EAF4EC` bg / `#9CCBA6` border / `#1E6B2F` text | receipt POSTED banner |
| — | `#2E7D32` | receipt `مطابق` mark |
| — | `#B00020` | ACR `MatchText` (`✗` / `؟`) |

### 1.1 Flow direction — the trap

Both roots are RTL with **deliberate LTR islands**, each forced with `FlowDirection="LeftToRight"`:

- the **logo** (`Image`) — in both documents, so the artwork is never mirrored;
- every **`S.R. | H.` amount box group** on the receipt, so `S.R.` stays left of `H.`;
- the receipt's **English company block**;
- the receipt's **`Store.` and `No.`** groups (label then value, left-to-right);
- the receipt's **` Receiver Name /`** label.

**WPF mirrors `HorizontalAlignment` under RTL** — `Left` resolves to the visual *right*. A CSS port
must express these as logical `start`/`end`, never physical. Three places where the XAML attribute
reads counter-intuitively and the **paper is the authority** (raise at sign-off, §8-O1): the
`خصم فائض` box side, and the insets of `Store.`/`No.` in the title band.

### 1.2 Print geometry (WPF, as a baseline for ticket 241's decision)

Both printers build a `FixedDocument`, one `FixedPage` per model page, each a **fresh control
instance** (no on-screen chrome leaks onto paper), at a **24-unit margin**, with
**shrink-to-fit only**: `scale = min(1.0, (pageWidth − 48) / 780)` — 780 px fits portrait A4 at
scale 1 and narrower paper scales *down* proportionally, **never up**. Silent to a named printer
when the host supplies one, otherwise the OS print dialog.

---

## 2. Document A — سند قبض (RECEIPT VOUCHER), inventory

Ten `Auto`-height rows, top to bottom. Bottom margin of each band in the last column.

### Band 0 — POSTED banner · **conditional**

| # | Mark | Text (verbatim) | Flow | Type | Box | Source |
|---|---|---|---|---|---|---|
| A0.1 | banner | `تم الترحيل — POSTED` (em dash U+2014, spaces both sides) | RTL, centred | bold, `#1E6B2F` | bg `#EAF4EC`, border 1 px `#9CCBA6`, radius 3, padding `8,4` | shown iff `IsPosted` |

Margin `0,0,0,10`. **Not on the paper form** — a WPF addition (see §5). Full-width.

### Band 1 — company header

Three columns `* / Auto / *`. Under RTL: col 0 = visual **right**, col 2 = visual **left**.
Margin `0,0,0,8`.

| # | Mark | Text (verbatim) | Flow | Type |
|---|---|---|---|---|
| A1.1 | Arabic name | `صيدليات الدواء` | RTL, right block | 17, **bold** |
| A1.2 | CR | `س.ت : ٢٠٥١٠١٤٩٤٠/٠٠٢` (**Arabic-Indic digits**) | RTL | 12, normal |
| A1.3 | phone | `هاتف : ٩٢٠٠٠٠٨٣٨` (Arabic-Indic) | RTL | 12, normal |
| A1.4 | address | `حي الروابي طريق الملك فهد - ابراج اسمنت الشرقية` | RTL, **wraps** | 12, normal |
| A1.5 | PO box | `ص.ب ٤٣٢٦ الخبر ٣١٩٥٢` (Arabic-Indic) | RTL | 12, normal |
| A1.6 | country | `المملكة العربية السعودية` | RTL | 12, normal |
| A1.7 | **logo** | `logo-aldawaa.png` | **LTR forced** | Height 80, `Stretch=Uniform`, centred, margin `5,0` |
| A1.8 | English name | `Al-Dawaa Pharmacies` | **LTR island**, left block | 16, **bold** |
| A1.9 | CR | `C. R. : 2051014940/002` | LTR | 12, **bold** |
| A1.10 | phone | `Tel. : 920000838` | LTR | 12, **bold** |
| A1.11 | address | `Al Rawabi District, King Fahd Road, Eastern Cement Towers.` | LTR, **wraps** | 12, **bold** |
| A1.12 | PO box | `P.O. Box 4326 Al-Khobar 31952` | LTR | 12, **normal** ⚠ |
| A1.13 | country | `Kingdom of Saudi Arabia` | LTR | 12, **bold** |

⚠ A1.12 is the **only non-bold line** in the English block while its Arabic twin is uniformly
normal — an inconsistency in the XAML, not the paper (paper's English block is uniformly bold).
Decide at sign-off (§8-O2).

### Band 2 — `خصم فائض` box · **conditional content**

One bordered box, `MinWidth=220`, `MinHeight=34`, border 1 px **`#C00000`**, padding `8,4`,
margin `0,0,0,10`, no fill. Horizontal `StackPanel`, all three parts vertically centred.
Paper places it on the visual **right**, under the Arabic block.

| # | Mark | Text | Type | Source |
|---|---|---|---|---|
| A2.1 | label | `خصم فائض : ` (**trailing space**) | bold, `#C00000` | static |
| A2.2 | value | — | bold, ink | `VarianceText` → §7.3 |
| A2.3 | matched mark | `مطابق` | bold, **`#2E7D32`** | `MatchedMarkText` → §7.4 |

### Band 3 — title band

Three columns `* / Auto / *`; margin `0,0,0,10`.

| # | Mark | Text | Flow | Type | Source |
|---|---|---|---|---|---|
| A3.1 | store label | `Store. ` (trailing space) | **LTR island**, right column | 16, bold, `#C00000` | static |
| A3.2 | store value | — | LTR | 16, bold, `#C00000` | `StoreCode` |
| A3.3 | **title** | `سـنـد قـبـض` — **tatweel U+0640 between every letter pair**: `س ـ ن ـ د` ` ` `ق ـ ب ـ ض` | RTL, centred | **20, bold** | static |
| A3.4 | subtitle | `RECEIPT VOUCHER` | centred | 14, bold, **underlined** | static |
| A3.5 | S.R. caption | two `Run`s: `S.R.` **bold** + `  ريال` (**two leading spaces**, normal) | **LTR island**, centred | 12 | static |
| A3.6 | S.R. cell | — | LTR | bold, centred | `GrandParts.Whole`, `MinWidth=88` |
| A3.7 | H. caption | two `Run`s: `H.` **bold** + `  هـ` (two leading spaces; `هـ` = ه + tatweel) | LTR, centred | 12 | static |
| A3.8 | H. cell | — | LTR | bold, centred | `GrandParts.Minor`, `MinWidth=44`, group margin `6,0,0,0` |
| A3.9 | no. label | `No. ` (trailing space) | **LTR island**, left column | 16, bold, `#C00000` | static |
| A3.10 | no. value | — | LTR | 16, bold, `#C00000` | `NoText` → §7.2 (**`—` when unposted**) |

Amount-cell style (A3.6, A3.8 and every later cell): fill `#EDEDF2`, border **1 px `#1A1A1A`**,
padding `6,2`; digits **bold, centred both axes**. Caption sits **above** its cell; the box group
has margin `0,6,0,0` under the subtitle.

### Band 4 — date

Horizontal group, aligned to the paper's **right**; margin `0,0,0,10`.

| # | Mark | Text | Type | Source |
|---|---|---|---|---|
| A4.1 | label | `التاريخ ` (trailing space) | bold, ink, valign bottom | static |
| A4.2 | value | — | centred on a fill-line, `MinWidth=140` | `CollectedAt`, `yyyy-MM-dd HH:mm` |
| A4.3 | label | ` Date` (**leading space**) | bold, ink | static |

**Fill-line style** (every `______` on this form): bottom border only, 1 px `#8A8A8A`,
padding `6,0,6,1`, vertically bottom-aligned.

### Band 5 — receiver name

Columns `Auto / * / Auto`; margin `0,0,0,12`.

| # | Mark | Text | Flow | Type | Source |
|---|---|---|---|---|---|
| A5.1 | label | `استلمت أنا/ ` (**trailing space**) | RTL | bold, ink | static |
| A5.2 | value | — | RTL | **bold**, centred, fill-line | `CollectorName` |
| A5.3 | label | ` Receiver Name /` (**leading space**) | **LTR forced** | bold, ink | static |

### Band 6 — cash row

Columns `Auto / Auto / * / Auto`; margin `0,0,0,12`.

| # | Mark | Text | Flow | Type | Source |
|---|---|---|---|---|---|
| A6.1 | whole cell | — | **LTR island**, group margin `0,0,8,0`, valign bottom | amount cell, `MinWidth=70` | `CashParts.Whole` |
| A6.2 | minor cell | — | LTR, margin `2,0,0,0` | amount cell, `MinWidth=40` | `CashParts.Minor` |
| A6.3 | label | `نقدا - مبلغ وقدره ` (trailing space) | RTL | bold, ink | static |
| A6.4 | words | — | RTL | centred, **wraps**, fill-line (flexes) | `CashWords` → §7.5 |
| A6.5 | label | ` Cash - The Sum of` (leading space) | RTL container | bold, ink | static |

### Band 7 — bank / شبكة row

Identical geometry to band 6; margin `0,0,0,12`.

| # | Mark | Text | Source |
|---|---|---|---|
| A7.1 | whole cell | — | `CardParts.Whole`, `MinWidth=70` |
| A7.2 | minor cell | — | `CardParts.Minor`, `MinWidth=40` |
| A7.3 | label | `شبكة - مبلغ وقدره ` (trailing space) | static |
| A7.4 | words | — | `CardWords` → §7.5 |
| A7.5 | label | ` Bank - The Sum of` (leading space) | static |

### Band 8 — "this for day of"

Columns `Auto / * / Auto / * / Auto`; margin `0,0,0,**18**` (the widest gap on the form).

| # | Mark | Text | Type | Source |
|---|---|---|---|---|
| A8.1 | label | `وذلك عن يوم ` (trailing space) | bold, ink | static |
| A8.2 | weekday | — | centred, fill-line | `ShiftDay` as `dddd` under **`ar-SA`** → §7.6 |
| A8.3 | label | ` بتاريخ / Date ` (**leading *and* trailing space**) | bold, ink | static |
| A8.4 | date | — | centred, fill-line | `ShiftDay` as `yyyy-MM-dd` |
| A8.5 | label | ` This For Day of` (leading space) | bold, ink | static |

### Band 9 — name blocks (no wet-signature lines)

Two blocks in columns `* / 24 / *`; col 0 = visual **right** (collector), col 2 = visual **left**
(pharmacist). Each block is a 2×2 grid `Auto / *`, second row margin `0,6,0,0`.

| # | Mark | Text | Type | Source |
|---|---|---|---|---|
| A9.1 | label | `اسم المحصل : ` (trailing space) | bold, ink | static |
| A9.2 | value | — | **bold**, centred, fill-line | `CollectorName` |
| A9.3 | label | `الرقم الوظيفي : ` (trailing space) | bold, ink | static |
| A9.4 | value | — | centred, fill-line | `CollectorId` |
| A9.5 | label | `اسم الصيدلي : ` (trailing space) | bold, ink | static |
| A9.6 | value | — | **bold**, centred, fill-line | `PharmacistName` |
| A9.7 | label | `الرقم الوظيفي : ` (trailing space) | bold, ink | static |
| A9.8 | value | — | centred, fill-line | `PharmacistId` |

The paper's English words `Receiver` / `Pharmacist` beside these names are **commented out** in the
XAML (`<!--<Run Text="  Receiver" …>-->`). Deliberate — decide at sign-off (§8-O3).

---

## 3. Document A — receipt: conditional marks

| Condition | What changes | Rule |
|---|---|---|
| **POSTED banner** | A0.1 shown / hidden entirely (`BooleanToVisibility` — collapsed, so the band takes no height) | `IsPosted`, set true only by `MarkPosted(...)` — after the aggregate collection posts, or on any `FromInquiryRow` page (an inquiry row is by definition already collected) |
| **`No.` unassigned** | A3.10 renders `—` (em dash), not empty | `NoText => No == "" ? "—" : No` |
| **Balanced drawer** | A2.2 empty → box shows only the red `خصم فائض : ` label | `VarianceText(0) == ""` |
| **Over / short** | A2.2 = `فائض 10.25` / `عجز 3.250` — word + **unsigned** amount at currency precision | §7.3 |
| **مطابق case** | A2.3 = `مطابق` (green) **only when** `CashRoundingMatched && CashRoundingAbsorbed != 0` — a plainly balanced drawer (no fraction absorbed) is matched with `Absorbed == 0` and carries **no mark** | §7.4 |
| **`مطابق` + variance together** | Cannot co-occur in the SAR path: `Matched` means `Diff == 0`, which makes `VarianceText` empty. So the box shows *either* an amount *or* `مطابق`, never both. Note `Variance` and `CashRoundingMatched` come from the *same* `Reconcile` call in `BuildPages`; on the `FromInquiryRow` path `Variance` is taken off the row and the rounding flags are **left false** — so an HQ-rendered receipt **never shows `مطابق`** (§8-O4) |
| **Negative amount in a digit box** | sign rides the **whole** part only: `-3.25` → `-3` / `25` | §7.1 |
| **Absent / empty value** | Every fill-line renders an **empty line of its natural width** (fill-lines have `MinWidth` or flex, so the line is always drawn) — never a `0`, never collapsed. Money boxes are the opposite: a zero amount prints `0` / `00` |
| **3-decimal currency** | minor cells widen to 3 digits (`005`), variance to 3dp, tafqeet switches nouns; commercial rounding is **never** applied, so `مطابق` needs an exactly balanced drawer | §7.1, §7.4 |

---

## 4. Document B — ACR form, inventory

A single vertical `StackPanel`. Every page carries the **same `AcrForm`** (header + summary); only
`Rows` and `ShowSummary` differ.

### Band 0 — header

Three columns `120 / * / 120`; col 0 = visual **right**; margin `0,0,0,8`.

| # | Mark | Text | Flow | Type | Source |
|---|---|---|---|---|---|
| B0.1 | logo | `logo-aldawaa.png` — **the same resource the receipt uses**, deliberately (one mark on both documents a collector holds) | **LTR forced** | `MaxHeight=42`, `Stretch=Uniform`, top-aligned | static |
| B0.2 | title | `نموذج متابعة المبيعات النقدية ومبيعات الشبكة بالصيدليات` | RTL, centred | **13, bold** | static |
| B0.3 | page stamp | `صفحة {0}` where `{0}` = `PageText` = `"{PageIndex} / {PageCount}"` (spaces around the slash) → e.g. `صفحة 2 / 3` | RTL, left column, top | 10, normal | `PageIndex`/`PageCount` |

### Band 1 — meta strip, row 1

Three equal columns; margin `0,0,0,2`. Each cell is `label + value` horizontally.
Labels are **bold with margin `0,0,0,2`**; values normal.

| # | Label (verbatim) | Value source | Format |
|---|---|---|---|
| B1.1 | `عن يوم: ` (trailing space) | `Form.AcrDateText` | `dd/MM/yyyy`, invariant → §7.7 |
| B1.2 | `نموذج رقم ( ` + value + ` )` — **three separate `TextBlock`s**; the `( ` and ` )` are bold label style | `Form.AcrNumberText` (**bold**) | invariant integer, no padding |
| B1.3 | `المنطقة: ` (trailing space) | `Form.Areas` | free text |

### Band 2 — meta strip, row 2

Three equal columns; margin `0,0,0,8`.

| # | Label | Value source | Notes |
|---|---|---|---|
| B2.1 | `تاريخ التحصيل: ` | `Form.ClosedAtText` | **blank while the ACR is still OPEN** (`ClosedAt == DateTime.MinValue → ""`) |
| B2.2 | `الوصف: ` | `Form.Label` | free text |
| B2.3 | `الحالة: ` | `Form.Status` | server string, rendered as data |

### Band 3 — table header

Eleven columns, **fixed widths in px, right to left**:

| Col | Width | Header text (verbatim) |
|---|---|---|
| 0 | 26 | `م` |
| 1 | 58 | `رقم الصيدلية` |
| 2 | 68 | `تاريخ اليوم` |
| 3 | 66 | `المبيعات النقدية` |
| 4 | 66 | `مبيعات الشبكة` |
| 5 | 70 | `إجمالي المبيعات` |
| 6 | 56 | `رقم سند القبض` |
| 7 | 44 | `مطابقة الكاش والشبكة` |
| 8 | 108 | `اسم الصيدلي` |
| 9 | 62 | `رقم المشغل` |
| 10 | `*` | `ملاحظات` |

Header cell: fill `#EDEDF2`, border `#8A8A8A`, **`BorderThickness="0,1,1,1"` except col 0 which is
`1,1,1,1`** — i.e. each cell draws its top, bottom and *leading* edge, and the first column closes
the run. Header text: **10 px, bold, centred, wraps, vertically centred**, padding `3,2`.

### Band 4 — data rows

Same eleven widths. Cell style: border `#8A8A8A` **`0,0,1,1`** (bottom + leading edge), except
col 0 = `1,0,1,1`. Text: 10 px, centred, wraps, vertically centred.

| Col | Bound to | Type | Format |
|---|---|---|---|
| 0 | `SeqText` | normal | invariant integer, **1-based, continuous across pages** |
| 1 | `StoreCode` | normal | as-is |
| 2 | `SalesDateText` | normal | `dd/MM/yyyy` — **per-row; may differ from the header `عن يوم`** (catch-up ACRs) |
| 3 | `CashText` | normal | money → §7.7; source is **`NetCollected`** (what the collector was handed) |
| 4 | `CardText` | normal | money |
| 5 | `TotalText` | **bold** | money; `= NetCollected + CardTotal` |
| 6 | `ReceiptNoText` | normal | invariant integer, **not** zero-padded (unlike the receipt's own `No.`) |
| 7 | `MatchText` | **bold, `#B00020`** | tri-state → §4.1 |
| 8 | `PharmacistName` | normal | closer's name |
| 9 | `OperatorId` | normal | closer's StaffID |
| 10 | `Notes` | **9 px** (the one smaller cell) | `""`, or `Z report missing` — **an English literal, not localized** ⚠ (§8-O5) |

`StoreName` and `IsShortfall` exist on `AcrFormRow` but **the WPF binds neither** — `IsShortfall`
(issue 132: a negative `NetCollected`) is stated to get "a warning style" in the Excel/WPF, and the
control does not implement it. Flag at sign-off (§8-O6).

### Band 5 — totals row · **last page only**

Five columns `152 / 66 / 66 / 70 / *`. The three money columns line up with data columns 3–5.

| # | Mark | Text | Type | Source |
|---|---|---|---|---|
| B5.1 | label cell | `الاجمالي` | head-cell fill `#EDEDF2`, bold 10, border `1,0,1,1` | static |
| B5.2 | cash total | — | **bold** | `Form.CashTotalText` = Σ `NetCollected` |
| B5.3 | card total | — | **bold** | `Form.CardTotalText` = Σ `CardTotal` |
| B5.4 | grand total | — | **bold** | `Form.GrandTotalText` = cash + card |
| B5.5 | filler | a single space `" "` | plain cell | keeps the run's borders closed |

### Band 6 — ملخص التحصيل + signature · **last page only**

Outer columns `340 / 20 / *`; margin `0,12,0,0`.

**Summary box** (col 0):

| # | Mark | Text | Type |
|---|---|---|---|
| B6.1 | box title | `ملخص التحصيل` | head cell, full border `1,1,1,1`, bold 10, centred |
| B6.2 | row label | `اجمالي الايرادات` | **`TextAlignment=Right`** (the only right-aligned cells on the form), normal |
| B6.3 | row value | — | `Form.RevenuesText` = grand total |
| B6.4 | row label | `اجمالي ايداع المحصل` | right-aligned, **bold** |
| B6.5 | row value | — | **bold**, `Form.DepositText` = cash total |

Inner grid `220 / *`, both label cells border `1,0,1,1`.

**Signature block** (col 2, bottom-aligned):

| # | Mark | Text | Source |
|---|---|---|---|
| B6.6 | label | `الأسم: ` (**note the spelling — `الأسم`, with hamza, not `الاسم`**) | static, bold |
| B6.7 | value | — | `Form.CollectorName` |
| B6.8 | open paren | `  ( ` (**two leading spaces**) | static, normal |
| B6.9 | value | — | `Form.CollectorId` |
| B6.10 | close paren | ` )` | static |
| B6.11 | label | `التوقيع: ` | static, bold, group margin `0,0,0,10` above |
| B6.12 | **empty signature line** | a single space `" "` in a `Width=180` border, bottom edge 1 px `#8A8A8A` | **always empty — a wet signature, never printed** |

---

## 5. Document B — ACR: conditional marks

| Condition | What changes | Rule |
|---|---|---|
| **`MatchText` per row** | **blank** = the commercial-rounded reconciliation matched (no mark on a good row); **`✗`** (U+2717) = a real whole-riyal diff; **`؟`** (Arabic question mark U+061F) = **the shift/Z mirror never synced** — unknown, *not* OK | `Match == null ? "؟" : (Match ? "" : "✗")`; `Match = HasShiftReport ? Reconcile(SystemCash, CountedCash).Matched : null`. **Recomputed at HQ from the synced Z figures**, never read off the receipt's persisted flag (which stays 0 on the POS_Server mirror) |
| **Missing Z** | col 10 `ملاحظات` = `Z report missing`, and col 7 = `؟`. `Variance` is forced to `0` | `HasShiftReport == false` |
| **Summary block** | Bands 5 + 6 shown **only on the last page** (`ShowSummary = i == chunks.Count - 1`) — collapsed elsewhere, so earlier pages simply end after the last data row | |
| **Empty ACR** | `Paginate` emits **one page with zero rows** ("an idle ACR still prints one page") — header, empty table body, totals of `0.00`, summary and signature all present | |
| **Page stamp** | always rendered, even on a single-page form: `صفحة 1 / 1` | |
| **Un-banked ACR** | `DepositNumberText => ""` (not `0`) — but the control **binds neither `DepositNumberText` nor `DepositStatus`**; they exist on the model unused ⚠ (§8-O7) |
| **Zero money** | prints `0.00` (SAR) / `0.000` (3dp) — never blank |

---

## 6. Paper ↔ WPF reconciliation

### 6.1 Receipt — `Collection Receipt.jpg`

The WPF is a **close facsimile**; band order, the three-part header, the centred title with its
`S.R. | H.` box, the two words-lines with left digit boxes, the day line and the two name blocks
all match the paper. Differences, all deliberate:

| Paper | WPF | Note |
|---|---|---|
| red `PH.` at top-right of the title band | `Store. {StoreCode}` | same slot, renamed |
| `خصم فائض :` red box, **empty** | same box, filled from `VarianceText` + `مطابق` | |
| no POSTED banner | green `تم الترحيل — POSTED` band above the header | new state the paper had no way to carry |
| `وذلك عن يوم ____ بتاريخ __/__/__` (slash cells) | two fill-lines: **`ar-SA` weekday name** + `yyyy-MM-dd` | |
| `Pharmacist` / `Receiver` English words beside the name lines | **commented out** | §8-O3 |
| dotted fill-lines | solid 1 px `#8A8A8A` bottom border | |
| `No.` blank (hand-written from the book) | 10-digit zero-padded, or `—` | §7.2 |

### 6.2 ACR — `Scanned Document 4.pdf` (rendered: [`242-acr-paper-original.png`](242-acr-paper-original.png))

The WPF **reshaped** this form (the XAML says so, per issue 112 + "Slice 2"). The paper original is:

- **DMSCO** logo top-right — **not** al-dawaa. The WPF deliberately uses the al-dawaa mark so the
  two documents a collector holds carry one brand. **The single largest visual divergence; must be
  confirmed at sign-off** (§8-O8).
- meta row 1: `عن يوم ____` (right) · `الموافق : / /` (the Hijri/Gregorian companion date) —
  **`الموافق` is dropped entirely by the WPF**.
- meta row 2: `تاريخ التحصيل: / /` · `نموذج رقم ( )` · `المنطقة :` — the WPF **promotes**
  `نموذج رقم` and `المنطقة` into row 1 and **adds** `الوصف` and `الحالة` to row 2.
- table columns, right→left: `م` · `رقم الصيدلية` · `المبيعات النقدية` · `مبيعات الشبكة` ·
  `إجمالي المبيعات` · `رقم سند القبض` · `مطابقة الكاش والشبكة` · `اسم الصيدلي` ·
  **`توقيع الصيدلي`** · `ملاحظات`. The WPF **inserts `تاريخ اليوم`** as column 2 and **replaces
  `توقيع الصيدلي` with `رقم المشغل`**.
- **exactly 18 pre-ruled rows**, numbered 1–18. The WPF has **no fixed row count** — rows are
  dynamic and print paginates at 22.
- `الاجمالي` row spans the money columns — kept.
- `ملخص التحصيل` box, **five** rows: `اجمالي الايرادات` · `اجمالي فرق ( العجز ) المستلم +` ·
  `اجمالي فرق ( الفائض ) المخصوم -` · `اجمالي ايداع المحصل` · `الفرق ( المتبقي او الزائد )`,
  plus a `سبب الفرق` box beneath. The WPF keeps **only** `اجمالي الايرادات` and
  `اجمالي ايداع المحصل` — the three difference rows and `سبب الفرق` were **dropped** (the
  collector reconciles cash, cards and deposit; the difference lives on the Z record).
- right of the summary: `الأسم :` / `التوقيع :` — kept verbatim, including the `الأسم` spelling.
- below that, two prose blocks — **`تعليمات عامه :`** (2 numbered items) and
  **`خطوات مراجعة الصيدلي :`** (7 numbered items) — **dropped wholesale** by the WPF.
- no page stamp on the paper (a single sheet); the WPF adds `صفحة n / m`.

---

## 7. The formatting rules behind every computed string

All of these are **currency-aware** through `VoucherCurrency.Resolve(code)`: `SAR` → 2dp,
`BHD`/`KWD` → 3dp (دينار/فلس), `OMR` → 3dp (ريال/بيسة); **unknown or blank falls back to SAR**.
All digits are **invariant (Western)** — the Arabic-Indic digits on the form are *static header
text only* (A1.2/3/5), never a value.

### 7.1 Digit-box split — `CollectionVoucherFormat.SplitAmount`

`round(|amount|, dp, AwayFromZero)` → whole = truncated integer, minor = fraction × 10^dp,
**left-padded with `0` to `dp` width**; the sign (`-`) is prefixed to the **whole** only.
Pinned: `13333.23 SAR → 13333 | 23` · `0.5 SAR → 50` (not `5`) · `7.05 SAR → 05` ·
`13.005 BHD → 13 | 005` · `1.005 SAR → 01` (rounds into the halalas) · `-3.25 SAR → -3 | 25`.

### 7.2 Voucher `No.` — `CollectionVoucherFormat.VoucherNo`

The collection receipt's sequential number **zero-padded to 10 digits** (`#5 → 0000000005`); on a
legacy multi-shift receipt a 1-based `-{shiftIndex}` is appended (`0000000005-2`) so each page of
one receipt number stays unique. `NoText` substitutes **`—`** when `No` is empty (pre-post).

### 7.3 Variance — `CollectionVoucherFormat.VarianceText`

`""` when `variance == 0`; otherwise `فائض ` (over, trailing space) or `عجز ` (short) followed by
the **unsigned** amount at `F{dp}` — the word carries the direction.
Pinned: `10.25 SAR → فائض 10.25` · `-3.250 BHD → عجز 3.250` · `0 → ""`.

### 7.4 Commercial rounding — `CashRounding.Reconcile` (the `مطابق` rule)

The manager counts **whole riyals**, so the sub-riyal fraction of the *system-expected* cash is
absorbed as no-diff:

```
RoundedSystem = dp == 2 ? round(SystemCash, 0, AwayFromZero) : SystemCash
Diff          = CountedCash − RoundedSystem
Matched       = Diff == 0
Absorbed      = SystemCash − RoundedSystem
```

Whole-unit rounding applies to **2-decimal currencies only**; 3dp currencies carry fils and are
never rounded (`Absorbed == 0`). The receipt shows `مطابق` iff `Matched && Absorbed != 0` — a
plainly balanced drawer earns no mark. The **ACR recomputes this same rule per row** so HQ agrees
with the till byte-for-byte.

### 7.5 Arabic amount-in-words — `ArabicTafqeet.ToWords`

Shape: **`فقط {words} لا غير`**. Whole and fraction joined with `" و "`; zero renders
`فقط صفر {unit singular} لا غير`; a pure fraction drops the whole part entirely.
Counted-noun form follows the **last two digits**: `1` → singular + `واحد/واحدة` *after* the noun,
`2` → dual, `3–10` → plural, remainder `0` → singular, everything else → accusative singular.
Units precede tens (`ثلاثة و ثلاثون`). Gender comes from the noun (`هللة`/`بيسة` feminine) and
affects only the 1–19 words. Scale nouns (ألف/مليون/مليار) are masculine and take the plural only
at 3–10. Pinned: `3333.00 SAR → فقط ثلاثة آلاف و ثلاثمائة و ثلاثة و ثلاثون ريالا لا غير` ·
`10000.23 SAR → فقط عشرة آلاف ريال و ثلاث و عشرون هللة لا غير` ·
`3.005 BHD → فقط ثلاثة دنانير و خمسة فلوس لا غير` · `1.00 SAR → فقط ريال واحد لا غير` ·
`2.000 BHD → فقط ديناران لا غير` · `0 SAR → فقط صفر ريال لا غير` ·
`2.100 OMR → فقط ريالان و مائة بيسة لا غير` · `5.25 SAR → فقط خمسة ريالات و خمس و عشرون هللة لا غير`.

### 7.6 Receipt dates

`CollectedAt` → `yyyy-MM-dd HH:mm`. `ShiftDay` → **weekday name under `ar-SA`** (`dddd`) *and*
`yyyy-MM-dd`, in two separate fill-lines. `ShiftDay` itself falls back: `BusinessDay`, else
`ClosedAt.Date`, else `CollectedAt.Date` (rows predating shift-per-day carry `default(DateTime)`).

> The `ar-SA` weekday is the one string whose output depends on the .NET **culture**, and
> `ar-SA` is a **Umm al-Qura (Hijri)** calendar culture — worth pinning explicitly in the
> print-ready model rather than re-deriving it in JS (feeds ticket 245).

### 7.7 ACR money and dates — `AcrFormBuilder`

`MoneyText` = `amount.ToString("F{dp}", InvariantCulture)` — **no thousands separator**,
no currency symbol anywhere on the ACR form. `DateText` = `dd/MM/yyyy` invariant, used for both
`AcrDateText` and every row's `SalesDateText`. `ClosedAtText` is `""` at `DateTime.MinValue`.

### 7.8 ACR pagination

`Paginate(form, rowsPerPage = 22)` — a plain chunk of `Rows`; **no fixed 18-row cap** (the paper's
ruling is not reproduced), one empty page when there are no rows, `ShowSummary` on the last chunk
only, `PageIndex` 1-based.

---

## 8. Open questions the sign-offs must settle

Each is a place where the XAML, the paper, and the intended web output do not all agree. They are
**not** resolved here — they are the agenda for tickets 246 and 247.

- **O1 — mirrored alignment.** WPF flips `HorizontalAlignment` under RTL; three receipt marks
  (the `خصم فائض` box side, the `Store.` and `No.` insets) read counter-intuitively in the XAML
  against the paper. Judge the facsimile against the **paper**, and confirm the box side.
- **O2 — `P.O. Box 4326 Al-Khobar 31952`** is the only non-bold line in the receipt's English
  block; the paper's block is uniformly bold. Match the paper or the XAML?
- **O3 — `Receiver` / `Pharmacist`** English words beside the receipt's name lines are on the paper
  and commented out in the XAML. Restore or keep dropped?
- **O4 — `مطابق` never appears on an HQ-rendered receipt**: `FromInquiryRow` copies `Variance` but
  leaves `CashRoundingMatched`/`Absorbed` false, so the green mark is a POS-only artifact. Since
  the web renders *exactly* this HQ path, either the mark is dead code on the web or the print-ready
  model must carry the rounding flags (feeds ticket 245).
- **O5 — `Z report missing`** is a raw English literal produced by the builder, sitting in an
  Arabic form. Server-supplied text passes the i18n rule as data, but it is *ours* — replace with an
  Arabic note, or keep?
- **O6 — `IsShortfall`** (negative `NetCollected`, issue 132) is built and documented as
  "rendered with a warning style" but the WPF control **binds nothing**. Does the web owe the mark?
- **O7 — `DepositNumber` / `DepositStatus`** exist on `AcrForm` (design D21, the ACR's banking
  fate) and are **unbound** by the control. In or out of the web form?
- **O8 — the ACR logo.** The paper is **DMSCO**; the WPF prints **al-dawaa**. The single largest
  visual divergence on either document, and it is brand-facing. Confirm explicitly.
- **O9 — dropped paper furniture on the ACR**: `الموافق` (Hijri companion date), the 18 pre-ruled
  rows, the three difference rows + `سبب الفرق`, and both instruction blocks
  (`تعليمات عامه`, `خطوات مراجعة الصيدلي`). All dropped by the WPF, all still on the paper the
  stores use. Confirm each stays dropped.
