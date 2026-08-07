---
type: spec
status: ready
---

# 249 — The collection documents come to the web

Synthesized from wayfinder map
[240 — The collection documents come to the web](240-the-collection-documents-come-to-the-web.md),
whose eight tickets are all resolved and whose breaker — side-by-side sign-off on both documents —
is passed. Every decision below traces to a resolved ticket; where it does, the ticket is linked and
should be read for the reasoning this spec deliberately does not repeat.

## Problem Statement

The people who reconcile the chain's cash — the **collection supervisor** and the **accountant** —
can only do their job inside the WPF back-office client. Four screens live there and nowhere else:
Collection Inquiry, ACR Inquiry, Deposit Inquiry and Collection Attempts. So do the two printed
documents those screens exist to produce: the **سند قبض** collection receipt and the **ACR**
(نموذج متابعة المبيعات النقدية ومبيعات الشبكة — the accumulated collection receipt).

Four things hurt today:

1. **It is desktop-only.** Every other back-office surface this team touches has moved to the web
   portal. Collection has not, so reconciling cash means keeping one legacy client installed and
   switching to it.
2. **The grids truncate silently.** The WPF `Limit` box defaults to 200 rows. The scope of these
   screens is HQ-wide — every store in the chain — and a normal day is hundreds of rows, so an
   ordinary day's query is cut off with no indication that anything is missing.
3. **A document is not an address.** The WPF opens each document in a modal window. It cannot be
   linked, pasted into a ticket, or sent to a colleague — you tell them which row to click.
4. **The export is a base-class accident.** The XLSX button on those grids is inherited from
   `InquiryController`/`ListController` by ~40 unrelated screens, and it exports every cell as text
   — so the money in the file the accountant reconciles with **cannot be summed**.

And the constraint that makes this hard: the two documents are **paper forms**. They are RTL Arabic
facsimiles with fixed geometry, Arabic amount-in-words, digit-cell money boxes and a bilingual
company header. They must come out of the web looking like they come out of WPF, because the same
person files both.

## Solution

A new **Collections** area in the portal — four read-only inquiry screens plus the two documents,
each document at its own printable URL.

For the user:

- Open **Cash Collections**, **ACRs**, **Deposits** or **Collection Attempts** from a new Collections
  menu group. Each opens already loaded with today's activity — no clicking Load.
- Filter by the same things WPF offered, minus the `Limit` box. The result set is the whole day
  chain-wide, held in the browser and paged 50 at a time, so sorting, per-column filtering and
  exporting all operate over **every** matched row rather than one page.
- Click `Receipt ▸` or `Form ▸` and the document opens **in a new tab at its own URL** — a page whose
  entire body is the document, ready for Ctrl-P onto A4.
- Click **Export** and get a CSV that opens in columns in Excel with the Arabic names intact, the
  receipt and ACR numbers unmangled, and the money as **numbers you can sum**.

For the system, one rule governs the documents and is the reason they cannot drift from WPF:
**the client cannot format.** Every displayed value crosses the wire as a string already produced by
the same C# builders WPF binds — money, dates, the Arabic tafqeet, the tri-state match mark, the page
stamp, the `ar-SA` weekday, the Umm al-Qura date. No `decimal`, no `DateTime`, no `currencyCode` is on
the wire at all, so there is nothing for `toFixed(2)` to bite on. The server also **pre-paginates**:
it hands over pages, and the browser renders one fixed A4 block per page with `break-after: page`, so
no layout engine ever chooses a break. See
[245 §0](245-the-shape-of-a-print-ready-document.md).

The work splits into **two waves that run in parallel**:

- **Frontend wave** (this repo) — the four screens, the two facsimiles, print, export. It starts
  against **checked-in fixtures**, and this is required rather than convenient: every server route
  answers a browser **403** until the backend wave lands its doors
  ([243](243-what-the-server-already-hands-over.md)).
- **Backend wave** (`C:\Work\DMSCO\BackOffice`, SIS.Api) — one `CollectionWeb` door with seven routes
  and four grant filters, one added projection column, two strings-only mappers, and five edits to the
  existing builders. **Zero new SQL** beyond that one column.

## User Stories

### Getting in — access, nav, routing

1. As a collection supervisor, I want a **Collections** group in the portal menu, so that the screens
   I use for cash reconciliation live together and not scattered through Order Management.
2. As a user with no collection grants, I want the Collections group to be **absent entirely**, so
   that I am never offered a screen that will refuse me.
3. As a user granted only Deposits, I want to see **only the Deposits item** — a ragged group, not
   three items that would bounce me.
4. As the portal, I want **one `Collection/Access` probe** returning all four booleans in a single
   call, so that building the menu costs one request rather than four.
5. As a security reviewer, I want the **endpoint grant filter to be the real boundary** and the probe
   to be nothing but menu-hiding, so that a hand-typed URL is refused by the server and not merely
   hidden by the client.
6. As an existing WPF collection user, I want my **current four grants to carry over unchanged**
   (`CollectionInquiry`, `AcrInquiry`, `DepositInquiry`, `CollectionAttempts`), so that nobody has to
   re-seed permissions for the web.
7. As an accountant, I want supervisor-versus-accountant to be **which grants finance assigned me**
   rather than a different screen design, so that one person doing both jobs uses one surface.
8. As either role, I want **HQ-wide scope** — every store, no per-store confinement — because that is
   what reconciling the chain's cash requires.
9. As a user, I want each screen at a **stable, bookmarkable URL** under `/collection/*`, so that I can
   return to a screen directly.

### The four screens — landing, filtering, volume

10. As a supervisor arriving at any of the four screens, I want it **already loaded with today's**
    activity, so that "what has come in today" is answered before I touch a control.
11. As a supervisor, I want **From and To to default to today** and to travel as a pair, so that
    widening to yesterday is one edit rather than a form to fill.
12. As a supervisor on Cash Collections, I want to filter by **From · To · Store · Collector**.
13. As a supervisor on ACRs, I want to filter by **From · To · ACR No# · Collector · Status**, with
    Status as a segmented All / OPEN / CLOSED control.
14. As an accountant on Deposits, I want to filter by **From · To · Deposit No# · Collector · Bank ·
    Status**, with Status as a segmented All / POSTED / VOID control.
15. As a supervisor on Collection Attempts, I want to filter by **From · To · Store · Collector ·
    Reason code**.
16. As a user, I want the toolbar to build a **criteria draft that only Search commits**, so that
    half-typed filters never fire a query.
17. As a user, I want **Reset** to return the screen to its landing state — today, everything else
    cleared.
18. As a supervisor, I want the **`Limit` box gone** and the whole day's rows fetched, so that I stop
    silently losing rows past 200.
19. As a supervisor, I want the grid to **page 50 at a time in the browser** over the whole result
    set, so that sorting, per-column filtering and export all see every matched row.
20. As a supervisor, I want an **amber cap banner** when the result actually reached the system cap
    (~2,000), so that the one case where rows *are* missing is stated rather than silent.
21. As a supervisor, I want the **floating per-column filter row on by default**, so that finding one
    store's variance inside an HQ-wide result costs no round trip. (This deliberately inverts BBY
    Inquiry's default; see [244 §6](244-four-inquiry-screens-in-our-clothes.md).)
22. As a user short on vertical space, I want to **toggle that filter row off** and reclaim the height.

### Columns and money

23. As a supervisor, I want each grid to **lead with identity and money** in reading order, so the
    columns I use are the ones I see.
24. As a forensic user, I want the remaining columns behind a **More columns** toggle — **nothing is
    dropped**, only folded.
25. As a supervisor on Cash Collections, I want `Receipt No#`, `Store`, `Store Name`, `Collector`,
    `Collected`, `Net Collected`, `Variance`, `Card Total`, `Reason` by default, and `Opened`,
    `Closed`, `System Cash`, `Counted Cash`, `Float`, `Counted (Net)`, `Card Slips`, `Reason Detail`,
    `Collector Id`, `Z Reports` behind the toggle.
26. As a reader of money, I want figures **right-aligned, grouped, and rendered to their own
    currency's decimals**, so that BHD's three places and SAR's two are both correct.
27. As a reader of money, I want a **missing figure to be blank, not `0.00`**, so that "no value" and
    "zero" stay distinguishable.
28. As a reader, I want the **currency code in the column header** rather than repeated in every cell.
29. As a developer, I want `money.ts` to **graduate from Loy to `@/core`** on acquiring its second
    consumer — exactly as `pager.ts` did — because a feature may not import a feature.

### Drill-down and row actions

30. As a supervisor on Cash Collections, I want `Receipt ▸` to open the collection receipt **in a new
    tab**, so that my grid keeps its search, scroll and selection.
31. As a supervisor on ACRs, I want `Form ▸` to open the ACR document **in a new tab**.
32. As a supervisor on ACRs, I want `Collections ▸` to take me to Cash Collections **scoped to that
    ACR** via `?acr=<AcrId>`.
33. As a user in that scoped view, I want a **removable chip** naming the ACR, which visibly
    **overrides and disables** From/To/Store/Collector — honest, because the server treats `AcrId` as
    an exclusive filter and ignores the rest.
34. As a user, I want **clearing the chip** to drop the param and restore the ordinary today-filtered
    screen.
35. As a user, I want that scoped view to be **one shareable URL**, so I can send a colleague exactly
    what I am looking at.
36. As an accountant on Deposits, I want the slips to be **ordinary links opening in a new tab** —
    that is all `Open Slip(s)` ever did.
37. As an accountant on Deposits, I want the selected deposit's **claimed-ACR lines shown in place
    below the grid, with drift flagged**, because a deposit whose banked total no longer matches is
    exactly what I open this screen to find.
38. As an accountant, I want the **per-collector balance table** in a collapsible panel labelled
    *POSTED only*, arriving in the same response so no region costs a fetch.
39. As a supervisor on Collection Attempts, I want **no row action at all**, matching WPF — an attempt
    is immutable evidence, not a voucher.

### The export

40. As an accountant, I want an **Export** button on all four screens producing a **CSV**, so that the
    rows land in my reconciliation workbook.
41. As an accountant, I want the export to **sum**: money columns arrive as bare unformatted numbers,
    with no thousands separator, no currency symbol and no text wrapper, so `SUM` over the column
    works.
42. As an accountant, I want **receipt and ACR numbers to survive Excel intact** — no eaten leading
    zeros, no `1.23457E+11` — because those are the columns my workbook keys on.
43. As an accountant, I want the file to **open in columns on a double-click** in an Arabic Windows
    locale, with Arabic store and pharmacist names rendering correctly.
44. As an accountant, I want **every column in the file regardless of the More-columns toggle** — the
    file is the row unpacked, not the grid screenshotted.
45. As an accountant, I want the exported **rows to honour the active filter and sort**, so that I
    export the view I built.
46. As a security-minded user, I want a name or note beginning `=`, `+`, `-` or `@` to be **inert when
    the file opens**, not executed as a formula.
47. As an accountant, I want a **dated file name** so that three exports in one week do not collide.
48. As a user, I want the export to be **instant and offline** — the rows are already in the browser,
    so there is no walk, no progress bar, and no server call.

### The collection receipt (سند قبض)

49. As a supervisor, I want the receipt at **`/collection/receipt/:collectionReceiptId`**, a page whose
    entire body is the document — no nav, no shell, no hidden grid.
50. As a supervisor, I want the receipt to **reproduce the paper pad**: 780px fixed width, RTL flow,
    Tahoma Arabic, the bordered outer frame.
51. As a reader, I want the **bilingual company header** — Arabic block, al-dawaa logo, English block —
    with the Arabic-Indic digits in `س.ت : ٢٠٥١٠١٤٩٤٠/٠٠٢` and `هاتف : ٩٢٠٠٠٠٨٣٨` intact.
52. As a reader, I want the logo **LTR-forced** so that it never mirrors inside the RTL parent.
53. As a reader, I want **`No.` hard left and `Store.` hard right**, dropped to the `RECEIPT VOUCHER`
    line, as the pad has them rather than as the XAML tucks them.
54. As a reader, I want the red `خصم فائض` box **on the right and always empty** — it is a hand-fill
    slot on the pad, not an output field.
55. As a reader, I want **no POSTED banner**: a receipt that took a number *is* posted, so a green band
    restating it is chrome the paper never had.
56. As a reader, I want the `S.R.|H.` **digit cells** — grey fill, ink border, whole and minor split,
    LTR island inside the RTL parent so `S.R.` stays left of `H.` — for the grand total and for each of
    the cash and bank rows.
57. As a reader, I want the minor cell to **size to the value's own length** (2 digits for SAR, 3 for
    BHD) rather than to a currency lookup the client should not hold.
58. As a reader, I want **dot leaders** on the fill-lines, the pad's own texture, rather than the WPF's
    solid rules.
59. As a reader, I want the two **Arabic amount-in-words** lines (فقط … لا غير) rendered exactly as the
    server composed them.
60. As a reader, I want `Receiver` and `Pharmacist` **restored** — they are on the pad, and the XAML
    commented them out for no stated reason.
61. As a reader, I want `P.O. Box …` **bold** with the rest of the English block; the XAML's lone
    non-bold line is a slip.
62. As a reader, I want the English address to **wrap** rather than collide with the logo.
63. As a reader, I want dates as **ISO `yyyy-MM-dd`** and `Store. {code}` filled in, because this is a
    printed system record — nothing on it is hand-written, so a blank slot would be a regression.
64. As a supervisor, I want a **multi-shift receipt to print as several pages**, stamped
    `0000000005-1` / `0000000005-2`, ordered by the shift's `OpenedAt` ascending.
65. As a supervisor, I want an empty `pharmacistName` or `pharmacistId` to render an **empty
    fill-line**, never a `0`.

### The ACR form

66. As a supervisor, I want the ACR at **`/collection/acr/:acrId`**, same dedicated print route shape.
67. As a reader, I want the logo top-right at 42px, the centred title, and the **`صفحة n / m` stamp**
    top-left — the pad was one sheet, this prints three.
68. As a reader, I want both **meta strips**, including the blank `تاريخ التحصيل` of a still-OPEN ACR.
69. As a reader, I want the ACR's serial under **`رقم التجميعي`**, not `نموذج رقم ( )` — it is the ACR's
    own number, not a form-stock number, and the parentheses bracketed a blank a collector wrote into.
70. As a reader, I want the **`الموافق` Hijri companion date** restored beside the Gregorian one,
    pre-formatted server-side under an explicit Umm al-Qura calendar.
71. As a reader, I want the **eleven-column table at its exact widths**, header cells grey-filled,
    borders collapsing as the WPF `Cell`/`HeadCell` styles collapse them.
72. As a reader, I want the **header row repeated on every page** and the `م` sequence running
    **unbroken** across pages.
73. As a reader, I want the closer's id under **`رقم الصيدلي`** — the closer *is* the pharmacist, so the
    column says so and pairs with `اسم الصيدلي` beside it.
74. As a reader, I want the per-row `مطابقة` flag in all three states — blank, red `✗`, and `؟` for
    "the Z mirror never synced".
75. As a reader, I want a row whose Z report never reached HQ to say **`تقرير Z غير مُرحّل`** in
    Arabic, pairing with that `؟`, rather than an English `Z report missing` inside an Arabic form.
76. As a reader, I want a **negative figure to render as an LTR island** (`-412.50`, not `412.50-`), so
    the minus does not resolve to the RTL paragraph direction.
77. As a reader, I want a shortfall row to carry the **mismatch-red warning style**.
78. As a reader, I want the **last page only** to carry the `الاجمالي` band, the `ملخص التحصيل` box and
    the collector name/id with the wet-signature line.
79. As a reader, I want `ملخص التحصيل` **on the left and the signature on the right**, as the pad has
    them — the WPF swapped the two for no stated reason.
80. As a reader, I want `ملخص التحصيل` to carry **one row, `اجمالي الايرادات`** — every deposit mark is
    gone from this form, because the ACR states what was *collected*; where the money went afterwards
    is the deposit's own document.
81. As a reader of a catch-up ACR, I want the **per-row `تاريخ اليوم`** kept, because such an ACR
    carries more than one sales day and a single header date cannot say which row is which.
82. As a reader, I want the pad's **18 pre-ruled rows, three difference rows, `سبب الفرق` and both
    instruction blocks to stay dropped** — ruled lines and standing procedure exist for a pad being
    filled in, not a record being read.
83. As a supervisor, I want an **idle ACR to still print one page** with `rows: []`, totals `0.00` and
    the summary present.
84. As a supervisor, I want the page break to be the **server's arithmetic** (22 rows/page), so the
    browser never chooses one and the web and WPF sheets stay identical.
85. As a supervisor, I want the **worst case — one row alone on the last page under the whole summary
    block — to remain legible**, since that is a real 23-row ACR.

### Printing

86. As a supervisor, I want **Ctrl-P to produce one clean A4 sheet per model page** — `@page { size:
    A4; margin: 0 }`, one 210×297mm block, the document scaled to WPF's own ≈0.956.
87. As a supervisor, I want **no browser header/footer stamp** on the printed sheet.
88. As a supervisor, I want **every grey fill and rule to actually print**, which means no fill may sit
    on `<body>` — Chrome and Edge never print a body background even with `print-color-adjust: exact`.
89. As a supervisor, I want the printed output **verified on real Chrome and real Edge, on actual
    paper**, because both facsimile sign-offs deferred this and no CSS assertion can close it.
90. As a supervisor, I want the printed web sheet and the printed WPF sheet to be **the same document**
    — every mark present, positioned, flowed and coloured — without chasing a millimetre match, since
    the paper original itself already prints at ~96%.

### When something is missing

91. As a supervisor following a stale link, I want an unknown ACR or receipt to render a **"this
    document no longer exists"** state, **never a blank A4 sheet** — a blank sheet prints as
    convincingly as a real one.
92. As a developer, I want a miss to arrive as an **envelope refusal with a machine code**
    (`AcrNotFound` reused, `CollectionReceiptNotFound` minted), never a bare 404, so the client
    branches on `apiErrorCode` per the `api-envelope` rule.
93. As a supervisor, I want an **ACR with no linked collections to be a success, not a miss** — one
    page, no rows. Only an unknown id refuses.
94. As a user hitting a screen I lack the grant for, I want the **server's refusal** to be what stops
    me, surfaced as a business outcome rather than an "unexpected error".

### Building it in two waves

95. As a frontend developer, I want the two documents' **checked-in fixtures** to be test-pinned
    transcriptions of the fidelity inventory, so that a wrong-looking string on screen is a rendering
    fault and never a fabricated datum.
96. As a frontend developer, I want the fixtures to carry **247's four paging scenarios as scenarios**
    — 47 rows, 25 rows, 23 rows, 0 rows — rather than one happy path.
97. As a reviewer, I want it written down that the frontend **may not compute any displayed value** —
    no `toFixed`, no `Intl.NumberFormat`, no date formatting, no tafqeet, no page chunking, no deriving
    the match mark. A missing string is a server change, not a client one.
98. As a reviewer, I want it written down that the fixture's **shapes are contractual but its values
    are not** — longer Arabic names, a wrapping `areas`, a 3dp minor cell and the one-row-last-page
    count must all survive.
99. As a reviewer, I want it written down that **live data is not ordered or complete like the
    fixture** — `pages` is never empty but `rows` may be, and `closedAtText`, `notes`, `pharmacistName`
    and `pharmacistId` are all legitimately `''`.
100. As a team lead, I want the **first live call treated as a wave-joining event with its own
     verification**, not a checkbox — the fixture proves rendering, but it cannot prove the door, the
     grant, or `ar-SA` resolving on net8.0 under IIS.

## Implementation Decisions

### Where the code lives

- **A new top-level area, `src/features/collection/`**, at `/collection/*` under a **Collections**
  menu group. Not `features/oms/` — this is a finance surface, and the rule ties folder = URL prefix =
  menu group. Follows how `callcenter`, `loy` and `nphies` each minted a group
  ([244 §2](244-four-inquiry-screens-in-our-clothes.md)).
- **One feature, not four siblings** — the rule's "tight cluster of screens". Four Pages, one `api.ts`
  over all seven routes, one `collection` i18n namespace, both document renderers, and shared helpers
  as **relative** imports. Four siblings would have forced every helper up into `core/` before the
  second screen existed to justify it.
- The `246`/`247` prototypes currently at `src/features/oms/collection/__prototype__/` **move** to
  `features/collection/`; their fixtures graduate into the feature and the prototype components are
  **rewritten, not promoted** (they were written with inline styles standing in for XAML setters, no
  i18n, hard-coded models and no tests — what they settle is every mark's ruling, not its
  implementation).

| Menu item | Route |
|---|---|
| Cash Collections | `/collection/collections` |
| ACRs | `/collection/acrs` |
| Deposits | `/collection/deposits` |
| Collection Attempts | `/collection/attempts` |
| *(document)* | `/collection/receipt/:collectionReceiptId` |
| *(document)* | `/collection/acr/:acrId` |

### The screen template

Templated on `features/pricing/bonus-buy-inquiry` — the only screen in this repo built to the same
WPF skeleton: access gate → toolbar producing a **criteria draft** that only Search/Reset promote to a
query → AG Grid → row action → export, plus the cap banner. **Copied, not extracted**: no shared
inquiry shell in `core/`, because the abstraction would be designed before four screens exist to prove
it, and a feature may not import a feature. Deliveries was rejected as the template — saved grid views
and `ViewManager` are machinery four read-only grids would inherit and never use.

**Volume.** The client asks for a generous `Limit` (~2,000) and renders the whole result into AG Grid's
**built-in client-side pagination at 50/page**. True server paging via `@/core/ui/GridPager` was
rejected: none of the four endpoints has `Skip`/`Offset`/a total count, so it would mean real
`OFFSET/FETCH` + `COUNT` SQL on four endpoints on top of the doors, and it would confine sort,
per-column filter and export to the current page. `Limit` therefore stops being a user-facing field
and becomes a system cap, surfaced only by the amber banner when a result actually reaches it.

**Money** — `features/loy/member/money.ts` **moves to `@/core/money.ts`** and Loy imports it from
there, exactly as `pager.ts` graduated at ticket 232 on acquiring a second consumer. It already
encodes: `currencyDecimals` (KSA + Bahrain, BHD the estate's only 3-decimal currency), fixed `en-US`
grouping so two readers never see the same line differently, **blank rather than `0.00`** for a
missing figure, and the sign left as the row's own.

### The `?acr=` drill-down

`?acr=<AcrId>` scopes Cash Collections to one ACR, showing a removable chip that **overrides and
disables** From/To/Store/Collector — honest, because the server treats `AcrId` as an exclusive filter
and ignores period/store/collector entirely. Clearing the chip drops the param and restores the
today-filtered screen. Reuses the `?bby=` deep-link idiom. A side pane and an AG Grid master-detail row
were both rejected — the latter is an Enterprise feature this repo does not have.

### The export — one writer, two escaping rules

Client-side CSV over the rows already in the browser: **no server call, no walk, no new dependency**
([248](248-whether-the-web-owes-a-spreadsheet.md)). AG Grid **Community** has no `exportDataAsExcel`,
and its own `exportDataAsCsv` is visible-columns WYSIWYG — so the writer is ours, following
`ua-admin/csv.ts`'s pure rows-in-string-out shape, with AG Grid supplying only the filtered/sorted row
set. One generic writer takes each screen's column definitions.

The non-obvious part, and the reason it is not a copy of `ua-admin/csv.ts`: **two rules split by
column.** That file wraps every cell in `="…"` so leading zeros survive; for a column an accountant
sums, that makes the cell **text** and `SUM` silently reads zero.

| Column class | Rule |
|---|---|
| Money | **Bare unformatted number** — `1234.50`. No thousands separator, no symbol, no wrapper. Currency stays its own column. |
| Identity (receipt no., ACR no., store code) | **`="…"` text wrapper** — the reconciliation workbook keys on these, so they must survive Excel intact. |
| Free text (names, notes) | The **injection guard** — a leading `=`, `+`, `-` or `@` gets an apostrophe Excel eats on display. |
| Dates | **ISO text**, so they sort. |

Plus, carried verbatim from `csv.ts`: the **BOM** (what makes the Arabic names render) and the leading
**`sep=,`** line (Excel's double-click path uses the OS list separator — `;` in an Arabic locale).
File name follows `csvFileName`'s pattern: `collection-{screen}-{YYYY-MM-DD}.csv`.

The escaping primitives are a **`@/core` graduation candidate on the third consumer** — noted, not
extracted now.

### The two documents — the contract

Lifted verbatim from [245](245-the-shape-of-a-print-ready-document.md), which `/to-tickets` should
read in full. The governing rule is §0: **the client cannot format** — not "is asked not to", but
*unable to*, because no `decimal`, no `DateTime` and no `currencyCode` is on the wire.

**The receipt** — `{ pages: VoucherPage[] }`:

```ts
type AmountParts = {
  whole: string   // carries the sign on a negative: -3.25 → "-3"
  minor: string   // left-padded to the currency's dp: 0.5 SAR → "50"; 13.005 BHD → "005"
}

type VoucherPage = {
  noText: string          // 10-digit zero-padded, + "-{n}" on a multi-shift receipt
  storeCode: string
  collectedAtText: string // yyyy-MM-dd HH:mm
  collectorName: string
  collectorId: string
  pharmacistName: string  // '' is legal — renders an empty fill-line, never a 0
  pharmacistId: string    // '' is legal
  grand: AmountParts
  cash: AmountParts
  card: AmountParts
  cashWords: string       // فقط … لا غير
  cardWords: string
  shiftDayName: string    // weekday under ar-SA, PINNED server-side
  shiftDayText: string    // yyyy-MM-dd
}
```

Carrying **no reconciliation data at all** — no `isPosted`, no `varianceText`, no `matchedMarkText`, no
rounding flags, no `currencyCode`. The 246 sign-off removed the POSTED banner and ruled the `خصم فائض`
box always empty, so `CashRounding.Reconcile` never runs on the receipt path.

**The ACR** — `{ form, rowsPerPage, pages: AcrPage[] }`, with the header **hoisted** (a naive
`List<AcrFormPage>` repeats the header *and all rows* once per page, since every page references the
same `AcrForm`):

```ts
type AcrRow = {
  seqText: string          // 1-based, CONTINUOUS across pages
  storeCode: string
  salesDateText: string    // dd/MM/yyyy — per-row, may differ from the header (catch-up ACRs)
  cashText: string         // F{dp} invariant, no separator, no symbol
  cardText: string
  totalText: string
  receiptNoText: string    // NOT zero-padded, unlike the receipt's own No.
  matchText: '' | '✗' | '؟'   // tri-state; '؟' = the Z mirror never synced
  pharmacistName: string
  pharmacistId: string     // the column is رقم الصيدلي
  notes: string            // Arabic; '' when there is nothing to say
  isShortfall: boolean     // gets the mismatch-red warning style
}

type AcrPage = {
  pageIndex: number        // 1-based
  pageCount: number
  pageText: string         // "2 / 3" — spaces around the slash; the صفحة {0} stamp
  showSummary: boolean     // last page only: الاجمالي band + ملخص التحصيل + signature strip
  rows: AcrRow[]
}

type AcrForm = {
  acrDateText: string      // عن يوم — dd/MM/yyyy
  hijriText: string        // الموافق — dd/MM/yyyy Umm al-Qura
  acrNumberText: string    // rendered under رقم التجميعي
  areas: string
  closedAtText: string     // تاريخ التحصيل — '' while the ACR is still OPEN
  label: string            // الوصف
  status: string           // الحالة — server string, rendered as data
  collectorName: string
  collectorId: string
  cashTotalText: string
  cardTotalText: string
  grandTotalText: string
  revenuesText: string     // ملخص التحصيل's ONE remaining row: اجمالي الايرادات
}
```

`rowsPerPage: 22` rides along as **documentation of the break rule — the client never applies it**.
`pages` is never empty: an idle ACR is one page with `rows: []`. Every deposit field is gone
(`depositNumberText`, `depositStatus`, `depositText`).

Also off the wire entirely, because nothing binds them: `storeName` (the form prints the code),
`variance` and `hasShiftReport` (both collapse into `matchText`), `createdAtText`, `currencyCode`.

### Print

Each document renders on its **own dedicated print route whose entire body is the document** — no
AppShell, no nav, no AG Grid hidden behind `@media print`
([241](241-what-a-browser-can-print-a-paper-form-with.md)).

- `@page { size: A4; margin: 0 }` — no margin box means nothing for the browser to stamp a
  header/footer into. The form carries its own inner padding.
- One 210×297mm block per model page with `break-after: page`; the document at `scale(0.956)`, which is
  WPF's own `min(1.0, (pageWidth − 48) / 780)`.
- **Every fill lives on a descendant, never on `<body>`** — Chrome and Edge never print a body
  background even with `print-color-adjust: exact`. Ship both the unprefixed property and `-webkit-`.
- `font-family: Tahoma, sans-serif`, no webfont: Tahoma is a Windows system font with Arabic coverage
  and these users are on Windows Chrome/Edge.
- The WPF's 24px page padding is **kept deliberately** even though it is below the ~10mm many lasers
  leave unprintable — matching WPF is what makes the two sheets identical, and whether the outer frame
  survives is a hardware question for the paper test, not one to pre-empt by drifting off the geometry.

### The documented exceptions

The two facsimiles are an explicit, **three-rule** exception — the Arabic *is* the form and `#C00000`
*is* the form:

- `i18n-zero-literal` — the Arabic literals are the document, not UI copy.
- `logical-tailwind` — the form's geometry is physical and mirrors nothing.
- **the colour-literal gate** — a whole-file exclusion in `tools/check-palette.mjs`, the same shape of
  permission the brand SVG holds. Verified load-bearing: without it the ACR's four files alone trip 22
  violations.

**Screen chrome around the documents obeys every rule**, unexceptionally.

### The backend wave (`C:\Work\DMSCO\BackOffice`, SIS.Api)

One door, four gates — `CollectionWebEndpoints.cs`, tag `CollectionWeb`, following
`SdDocumentWebEndpoints`' one-tag-several-gates shape rather than five files of identical registration
boilerplate. The security boundary is the grant filter, not the file.

| Route | Grant (`BackOfficeScreen[…,'03']`) | Returns |
|---|---|---|
| `CollectionWeb/Collections` | `CollectionInquiry` | `CollectionInquiryModel[]` (`?acrId=` drill-down) |
| `CollectionWeb/Receipt/{collectionReceiptId}` | `CollectionInquiry` | print-ready `{ pages }` |
| `CollectionWeb/Acrs` | `AcrInquiry` | `AcrInquiryModel[]` |
| `CollectionWeb/AcrForm/{acrId}` | `AcrInquiry` | print-ready `{ form, rowsPerPage, pages }` |
| `CollectionWeb/Deposits` | `DepositInquiry` | `{ rows, balances }` |
| `CollectionWeb/Attempts` | `CollectionAttempts` | `CollectionAttemptInquiryModel[]` |
| `CollectionWeb/Access` | *(cookie-gated, not grant-gated)* | the one probe |

Every route: `ApiKeyEndpointFilter` + `.AllowCookieSession()` + its grant filter. Without the cookie
marker a browser gets a bare **403** (issue 802's default-deny inversion). **Deposit needs a genuinely
new door** — it rides `CollectorEndpointFilter`, which has no cookie branch at all. Document routes are
named for the **document**, not the server method (`Receipt`/`AcrForm`, not `Report`), precisely
because their payload is deliberately not what `Acr/Report` returns. Ids ride as **path segments**,
matching `LoyWeb/Member/{loyId}`.

The rest of the wave:

1. **`CollectionReceiptId` onto the projection.** `CollectionReceiptNo` is `SequentialNumber`, minted
   gap-free **per store**, so it does not identify a receipt HQ-wide. Add
   `cr.CollectionReceiptId` (ULID, the PK) to `PosCollectionInquiryService`'s SELECT, to
   `CollectionInquiryModel`, and as a filter on `CollectionInquiryOptions`. It becomes the URL key:
   opaque, deep-linkable, refresh-safe, and not walkable across stores the way `?no=91234` would be.
2. **`MarkPosted` over the page set.** The inquiry joins `PosShift` → `PosCollectionReceipt`, so a
   receipt covering several shifts returns several rows, and today's HQ path calls
   `MarkPosted(oneItemList, …)` per row → **duplicate `0000000005` stamps**. The door must fetch all
   rows for the receipt id, build one page each, and mark the whole list, restoring `-1` / `-2`.
   **Page order is contractual, not cosmetic** — it decides which shift is `-1`. Order by the shift's
   **`OpenedAt` ascending**; the inquiry's own `ORDER BY cr.CollectedAt DESC` is receipt-level and
   therefore non-deterministic within one receipt.
3. **`AcrFormBuilder` edits** — `OperatorId` → `PharmacistId`; all three deposit fields out;
   `hijriText` in; `notes` in Arabic.
4. **Two strings-only mappers**, one per document. The checked-in fixtures are their spec.
5. **Two pinned formatters with pinned tests.** WPF got the weekday from a `ConverterCulture=ar-SA`
   binding on a Windows desktop; SIS.Api is **net8.0**, a different globalization stack. Weekday =
   `dddd` under `CultureInfo("ar-SA")`; `الموافق` = `dd/MM/yyyy` under an explicit
   **`UmmAlQuraCalendar`**, not merely `ar-SA`'s default. Both need unit tests in `Data.Tests` beside
   the tafqeet tests — **if globalization degrades the failure is not a crash, it is `Thursday` quietly
   appearing on an Arabic form.**

Expect the known net472/net8.0 **CS1705** TFM skew on the new dependency edge, and dodge it the way
`DepositEndpoints.AddServices` already documents. **Zero new SQL** beyond the one added SELECT column.

### Envelope contract

All calls go through `src/core/api.ts` per the `api-envelope` rule. Business refusals arrive in the
envelope with a machine code the client branches on via `apiErrorCode`:

| Code | Meaning | UI |
|---|---|---|
| `AcrNotFound` | unknown `acrId` — **reused**, no second code for the same fact | the print route's "this document no longer exists" state |
| `CollectionReceiptNotFound` | **new** — unknown id *or* zero rows (indistinguishable on a lookup over the inquiry) | same |

Never a bare 404, and **never a blank A4 sheet** — a blank sheet prints as convincingly as a real one.
**Empty is not a miss:** an ACR with no linked collections is a 200 with one page and `rows: []`.

### Registration points

Per the feature-structure checklist: the four Pages plus two document routes in `src/app/router.tsx`;
a `collection` namespace at `src/locales/en/collection.json` registered in `src/core/i18n.ts`; four
menu items under a Collections group in `src/layout/menu-model.ts` with the single `Collection/Access`
probe as their `accessProbe`.

## Testing Decisions

**What makes a good test here:** it asserts what a user or a downstream system can observe — the
string in the exported cell, the params on the wire, which filters the chip disabled — and never how
the module reached it. The bar this feature raises specifically: **do not test what 245's contract
already makes impossible.** There is no client-side money formatting, date formatting, tafqeet,
pagination or match-mark derivation to assert, because the client is unable to do any of it. A test
that reimplements a server string in order to compare against it would be inventing the very drift
this design exists to prevent.

**This feature does not bootstrap React Testing Library.** Spec 083's ruling holds and is unusually
well-supported here: the two facsimiles are the *purest* thin renderers in the repo — pure functions of
a server-shaped model with zero computation — which is exactly the case 083 said RTL does not earn its
keep on.

### Tier 1 — pure in-memory (`vitest`), where nearly everything lands

| Module | What is asserted | Prior art |
|---|---|---|
| the CSV writer | The **two-rule split**: a money column is a bare summable number; a receipt/ACR/store id keeps its `="…"` wrapper; a `=`-leading note is inert; the BOM and `sep=,` preamble are present; Arabic survives; **every column ships regardless of the More-columns toggle**; the file name is dated | `features/admin/ua-admin/csv.test.ts` |
| criteria → query params | The today-default date **pair**; a draft not promoted until Search; Reset returning the landing state; empty filters dropped rather than sent as `''` | `nphies/*/list-params.ts`, bby-inquiry |
| the `?acr=` scope | Which filters the chip **overrides and disables**; that clearing restores the ordinary today-filtered criteria; that the param round-trips through the URL | `core/bonus-buy/deep-link.ts` |
| column model | The forensic tail **hides nothing** — every wire field appears in exactly one of the two groups — and the export column set is the union | `loy/member/*-columns.test.ts` |
| `@/core/money.ts` | Moves with **`money.test.ts` intact**; that existing test is the regression net for the graduation, exactly as `pager.test.ts` was at ticket 232 | `core/ui/pager.test.ts` |
| cap banner | Fires only when the result actually **reached** the cap, not merely when it is large | — |

### Tier 2 — the documents: typecheck plus checked-in fixtures

The two fixtures graduate out of `__prototype__/` into the feature as **test-pinned transcriptions of
the fidelity inventory's §7**, so a wrong-looking string on screen is a rendering fault and never a
fabricated datum. They carry **247's four paging scenarios as scenarios** — 47 rows (3 pages), 25
(short last page), 23 (**one row alone on the last page under the whole summary**), 0 (the idle ACR) —
plus a negative figure for the LTR island and a 3-decimal currency for the minor cell. `npm run
typecheck` against the contract types is the structural guard; the visual guard is Tier 3.

### Tier 3 — Playwright drives (manual-run tools, not CI gates)

Following the repo's `tools/*-drive.mjs` convention (`npx vite --port 5199` in one shell, `node
tools/<x>.mjs` in another):

- **`tools/collection-drive.mjs`** — the four screens: the access gate and the ragged menu group, the
  today landing state, Search/Reset, the More-columns toggle, the floating filter row on by default,
  client paging at 50, the cap banner, the `?acr=` chip disabling its siblings, and a downloaded CSV
  read back and asserted.
- **`tools/collection-print-drive.mjs`** — both documents across every fixture scenario: the page
  count, the unbroken `م` sequence, the header repeating, the summary landing on the last page only,
  the negative figure's LTR island, and the `—` that should never appear on the receipt.

Prior art: `tools/bby-inquiry-drive.mjs` (nearest — the template screen), `tools/ua-users-scale-drive.mjs`
(the export flow), `tools/document-rtl-drive.mjs` and `tools/sim-rtl-drive.mjs` (RTL rendering).

### Tier 4 — the paper proof, and it gets its own blocking ticket

241's two gotchas are **hardware questions no assertion can close**, and both facsimile sign-offs
explicitly deferred them here: (a) the browser header/footer stamp is injected outside the document, so
only `@page { margin: 0 }` suppresses it — and a user who re-enables margins in the print dialog gets
it back; (b) the background fills must all print. This is a **build ticket of its own with a printed
output checklist, blocking the wave's completion** — on real Chrome *and* real Edge, on actual paper,
both documents. Making it a ticket rather than a Proof box is deliberate: split across two facsimile
tickets it would evaporate.

Its failure is also the documented **trigger for the PDF effort** — see Further Notes.

## Out of Scope

- **Write actions.** `Acr/Create`, `Acr/Close`, collecting a shift, reopening. The web is an inquiry
  surface; the acting stays in POS/WPF.
- **Any change to the WPF POS or its XAML voucher.** POS keeps its own; this adds a web rendering
  beside it. "Same form" means the outputs match, not that one component serves both.
- **An Excel rendering of the ACR *document*** (the WPF's `AcrFormExcelWriter`). It would be a third
  rendering to keep in sync with the WPF writer and the React facsimile — 241's exact argument against
  a server PDF — and the WPF writer has *already* fallen three marks behind 247's sign-off, which is
  that argument realised rather than predicted. Print the form, export the grid; the ACR Inquiry grid's
  rows are the form's rows.
  ([248](248-whether-the-web-owes-a-spreadsheet.md))
- **Server-rendered PDF.** `System.Printing` is unsupported in ASP.NET, SIS.Api never references the
  project the two `UserControl`s live in, and the only cheap PDF path (headless Chromium) renders this
  very HTML — so there is no ordering in which starting with PDF saves work.
  ([241](241-what-a-browser-can-print-a-paper-form-with.md))
- **True server paging** on the four grids. No endpoint has `Skip`/`Offset`/a count, and client paging
  keeps sort, filter and export over the whole result set.
- **A shared inquiry shell in `core/`.** BBY's shape is copied, not extracted — revisit when a fifth
  screen proves the abstraction.
- **Per-store scoping** of either role. Both see the chain; `StoreId` is a filter, not a guard.
- **`Acr/Unlinked`** (mirrored receipts unlinked past SLA) — a possible future collection-health
  screen, noted and not proposed.
- **New permissions.** The four existing WPF grants are reused unchanged.
- **RTL/Arabic UI for the screen chrome.** The chrome stays en-only under the standing rules; only the
  documents are Arabic, as a documented exception.

## Further Notes

**The one unfinished mark on either document is a file, not a decision.** The paper original prints a
**DMSCO** logo, the WPF prints al-dawaa, and the receipt pad carries a *horizontal* al-dawaa lockup
(`care for life / نهتم بالحياة`) that exists in **neither repo**. Both facsimile prototypes render the
stacked al-dawaa the WPF ships rather than faking the missing mark. This is one decision covering both
documents and it needs an **asset from the brand side**; it blocks nothing structurally, but neither
facsimile is truly finished until it lands. Whoever slices tickets should carry it as an explicit
open item rather than letting it disappear into "styling".

**Why "matches the WPF" and "matches the paper" are different tests for the ACR.** The WPF *reshaped*
that form rather than copying it — the paper's DMSCO logo, 18 pre-ruled rows, signature column,
five-row summary and both instruction blocks are all gone. The rule both sign-offs applied, and the one
a builder should carry forward when a question arises that this spec does not answer: **where the WPF
departed from the paper because it knows something the blank pad could not, keep the departure; where
it departed by accident or omission, go back to the paper.**

**A `—` on the receipt is a bug, not a state.** `NoText`'s unposted em-dash stays in the shared builder
but is unreachable on the web — the inquiry filters `CollectionStatus = 'COLLECTED'`, and the sign-off
made `No.` the posted state itself. If one appears on screen, chase it; do not design for it.

**Two builder bugs found while charting, both worth fixing rather than reproducing:** the duplicate
`No.` on a multi-shift receipt (handled above), and the negative-figure bidi resolution — `412.50-`
instead of `-412.50` — which **the WPF does too**. The fidelity inventory's list of required LTR islands
was one short.

**The trigger for a later PDF effort**, should it open: the paper gate failing on real hardware; a need
to **store or send** a document (archive it against the collection record, email the accountant — a
browser print is not a file); unattended/silent printing the way WPF prints to `POSMachine.PrinterName`;
or a non-Windows client becoming a real user, which breaks the Tahoma-is-a-system-font assumption. If it
opens, take **headless Chromium over QuestPDF** — same HTML, no licence, zero drift.

**Slicing note for `/to-tickets`.** The two waves are meant to run in parallel and live in different
repos: the frontend wave's tickets are minted here in `.issues/`, and the backend wave's in
`C:\Work\DMSCO\BackOffice\.issues\`. The frontend wave has no hard dependency on the backend wave
until the first live call, which is itself a verification event with its own ticket rather than a
checkbox on someone else's. The paper proof (Tier 4) blocks wave completion but nothing upstream of it.
