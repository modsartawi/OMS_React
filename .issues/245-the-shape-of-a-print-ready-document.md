---
type: wayfinder-ticket
wayfinder: grilling
map: 240
status: done
blocked-by: 241, 242, 243
---

# 245 — The shape of a print-ready document

## Question

The map settled that the builders run server-side and React renders a **print-ready model** —
pre-formatted money strings, Arabic amount-in-words, pre-paginated pages — so the WPF and web
outputs cannot drift. Design that contract. It is the whole backend wave and the frontend wave's
only input for the two documents.

With the fidelity inventory (242), the existing contract (243) and the print decision (241) in hand,
settle:

- **The two endpoints.** Routes, parameters, and what identifies a document — a collection row's
  key for the receipt, an ACR id for the form. Do they hang off the existing `PosCollection/*` and
  `Acr/*` tags, or a new one?
- **The model.** Field-by-field, mirroring `CollectionVoucherModel` / `AcrForm` + `AcrFormRow` +
  `AcrFormPage`. Every money value arrives as a *string* already formatted for its currency, and
  the whole/minor split arrives split. Nothing on the client formats an amount — that is the rule
  the WPF control already lives by and the reason the two agree.
- **Where the boundary sits on labels.** The map's exception makes the Arabic literals part of the
  React facsimile. Confirm that against 242: any label that is actually conditional or data-driven
  (`VarianceText`, `MatchedMarkText`, `MatchText`, the `صفحة {0}` stamp, the `ar-SA` weekday) is
  *data* and comes from the server; only the fixed chrome is a literal in the component.
- **Pagination ownership.** The server pre-paginates (`AcrFormBuilder.Paginate`, 22 rows/page,
  summary on the last page). Confirm the model carries pages explicitly, and what the receipt's
  multi-page case is — `CollectionVoucherBuilder.BuildPages` returns a list, so when is a receipt
  more than one page?
- **If 241 chose server PDF**, this ticket instead specifies the PDF endpoint plus whatever
  on-screen model the web still needs, and says explicitly how the on-screen view is kept from
  diverging from the printed artifact.
- **Whether the frontend can start against a mock.** If the answer is yes, the contract written
  here *is* the mock, and the two waves genuinely run in parallel. Say so, and say what the
  frontend must not assume.

**Input from 242:** the inventory is
[`assets/242-fidelity-inventory.RESEARCH.md`](assets/242-fidelity-inventory.RESEARCH.md); its §7 is
the complete list of computed strings the model owes, and §2/§4 name the field behind every mark.
Four findings land squarely on this contract:

- **`ar-SA` weekday** (`ShiftDay` as `dddd`) is the one value whose output depends on the .NET
  culture — and `ar-SA` is an Umm al-Qura (Hijri) calendar culture. Pin it as a server-formatted
  string; do not re-derive it in JS.
- **The HQ path drops the rounding flags** (§8-O4): `FromInquiryRow` copies `Variance` but leaves
  `CashRoundingMatched`/`Absorbed` false, so the green `مطابق` mark can never render on the path the
  web uses. Either the model carries the flags or the mark is out.
- **Three model fields the WPF builds but never binds** — `IsShortfall`, `DepositNumber`,
  `DepositStatus` (§8-O6, O7). Decide in or out before the contract freezes.
- **`Z report missing`** is a raw English literal minted by the builder into an Arabic form
  (§8-O5) — server-supplied, so it passes as data, but it is ours to choose.

Record the contract in the answer precisely enough that `/to-spec` can lift it verbatim.

## Comments

**From 246 (2026-08-07) — the receipt half of your contract just got smaller.**

The sign-off removed the green POSTED banner (`No.` *is* the posted state) and ruled the
`خصم فائض` box **always empty** — a hand-fill slot, not an output field. So the receipt's
print-ready model carries **no reconciliation data at all**: not `IsPosted`, not `VarianceText`,
not `MatchedMarkText`, and not the `CashRoundingMatched` / `CashRoundingAbsorbed` flags that
242 §8-O4 asked you to consider carrying. `CashRounding.Reconcile` never runs on the receipt path.
(Unchanged for the ACR, where `MatchText` is a real per-row output.)

The mock in
[`voucher-mock.ts`](../src/features/oms/collection/__prototype__/voucher/voucher-mock.ts) is a
first sketch of the shape — note that nothing on it is a number, a `Date`, or a currency code, and
that `shiftDayName` is pinned server-side because `ar-SA` is a Hijri culture. Strip the four dead
fields listed above from it and it is close to the contract.

**From 247 (2026-08-07) — and now the ACR half.**

The ACR's print-ready model is `AcrFormBuilder`'s output with three edits, all from the sign-off:

- **`OperatorId` → `PharmacistId`** — the column is `رقم الصيدلي`, the closer *is* the pharmacist.
- **`DepositNumber`, `DepositStatus` and `DepositText` all leave.** Not just the two unbound fields
  242 §8-O7 asked about: the sign-off removed `اجمالي ايداع المحصل` from `ملخص التحصيل` too, so the
  summary carries one row (`اجمالي الايرادات` = the grand total) and the ACR says nothing about
  banking. `CashTotalText` still earns its place — it is the `الاجمالي` band's cash column.
- **One new field: the Hijri `الموافق` date**, pre-formatted server-side (`dd/MM/yyyy` Umm al-Qura)
  like every other string on the form, for the same reason `shiftDayName` is: the calendar is a
  .NET culture question, not a JS one.

Unchanged: `MatchText` is a real per-row output, and `AcrNumberText` now renders under the label
`رقم التجميعي`. `Notes` should arrive **in Arabic** (§8-O5): `Z report missing` is our literal, not
the server's data, so the fix is in the builder.

Two shape notes the mock in
[`acr-mock.ts`](../src/features/oms/collection/__prototype__/acr/acr-mock.ts) makes concrete:
nothing on it is a number or a `Date`, and **pagination is part of the contract** — the endpoint
hands over pages (or `rowsPerPage` plus the arithmetic), because the browser choosing its own page
breaks is exactly what 241 ruled out.

## Answer

Grilled and signed off 2026-08-07. The contract below is the **whole backend wave's target** and the
frontend wave's only input for the two documents. `/to-spec` can lift it verbatim.

### 0. The rule the whole contract exists to enforce

**The client cannot format.** Every displayed value crosses the wire as a string already formatted by
the same C# code the WPF binds — money, dates, the Arabic amount-in-words, the tri-state match mark,
the page stamp, the weekday, the Hijri date. Not "the client is asked not to format" — **unable to**:
no `decimal`, no `DateTime`, no `currencyCode` is on the wire at all, so `toFixed(2)` has nothing to
bite on. This is the only mechanism by which the WPF and web outputs cannot drift, and every field
decision below follows from it.

### 1. One door, four gates — `CollectionWebEndpoints.cs`

Tag `CollectionWeb`, one file, following `SdDocumentWebEndpoints` (one tag, several gates) rather
than 243's five-file sizing: 244 ruled this is **one** React feature behind **one** `Access` probe,
and five files would be five copies of the same registration boilerplate. The security boundary is
the grant filter, not the file.

| Route | Grant (`BackOfficeScreen[…,'03']`) | Returns |
|---|---|---|
| `CollectionWeb/Collections` | `CollectionInquiry` | `CollectionInquiryModel[]` — raw grid rows (`?acrId=` drill-down per 244) |
| `CollectionWeb/Receipt/{collectionReceiptId}` | `CollectionInquiry` | **print-ready** `{ pages: VoucherPage[] }` |
| `CollectionWeb/Acrs` | `AcrInquiry` | `AcrInquiryModel[]` |
| `CollectionWeb/AcrForm/{acrId}` | `AcrInquiry` | **print-ready** `{ form, rowsPerPage, pages: AcrPage[] }` |
| `CollectionWeb/Deposits` | `DepositInquiry` | `{ rows, balances }` |
| `CollectionWeb/Attempts` | `CollectionAttempts` | `CollectionAttemptInquiryModel[]` |
| `CollectionWeb/Access` | *(cookie-gated, not grant-gated)* | the one probe |

Every route: `ApiKeyEndpointFilter` + `.AllowCookieSession()` + its grant filter (243: without the
cookie marker a browser gets a bare 403). **Deposit needs a genuinely new door** — it rides
`CollectorEndpointFilter`, which has no cookie branch at all.

The two document routes are named for the **document**, not the server method (`Receipt` / `AcrForm`,
not `Report`), precisely because their payload is deliberately *not* what `Acr/Report` returns. Ids
ride as **path segments**, matching `LoyWeb/Member/{loyId}`.

### 2. What identifies a receipt — `CollectionReceiptId`

`CollectionReceiptNo` is `PosCollectionReceipt.SequentialNumber`, **minted gap-free per store**
(`NewPosCollectionLifecycle.cs:168`) — so it does not identify a receipt HQ-wide. The real identity is
`CollectionReceiptId VARCHAR(26)` (ULID, the PK), which the inquiry projection **does not select
today**.

**Server change (small, and the only one 243 called "strained"):** add `cr.CollectionReceiptId AS
CollectionReceiptId` to `PosCollectionInquiryService`'s SELECT and to `CollectionInquiryModel`, and
add a `CollectionReceiptId` filter to `CollectionInquiryOptions`. URL:
`/collection/receipt/:collectionReceiptId`, opaque, deep-linkable, refresh-safe, and it cannot be
walked across stores the way `?no=91234` could.

### 3. The receipt — `{ pages: VoucherPage[] }`

**A receipt can be more than one page**, and this is a live edge the WPF never hits. The inquiry joins
`PosShift` → `PosCollectionReceipt`, so a receipt covering several shifts (`CoveredShiftCount > 1`)
returns **several rows**. `FromInquiryRow` builds each independently and calls
`MarkPosted(oneItemList, no, …)` → `VoucherNo(no, 1, 1)` → **no `-{shiftIndex}` suffix**, so today's
HQ path would mint two vouchers both stamped `0000000005`. The door must instead fetch **all** rows
for the receipt id, build one page each, and call **`MarkPosted` over the whole list**, restoring
`0000000005-1` / `0000000005-2`.

**Page order is contractual, not cosmetic** — it decides which shift is `-1`. Order by the shift's
**`OpenedAt` ascending**; the inquiry's own `ORDER BY cr.CollectedAt DESC` is receipt-level and
therefore non-deterministic *within* one receipt.

```ts
type AmountParts = {
  whole: string   // §7.1 — carries the sign on a negative: -3.25 → "-3"
  minor: string   // left-padded to the currency's dp: 0.5 SAR → "50"; 13.005 BHD → "005"
}

type VoucherPage = {
  noText: string          // §7.2 — 10-digit zero-padded, + "-{n}" on a multi-shift receipt
  storeCode: string
  collectedAtText: string // §7.6 — yyyy-MM-dd HH:mm
  collectorName: string
  collectorId: string
  pharmacistName: string  // '' is legal — renders an empty fill-line, never a 0
  pharmacistId: string    // '' is legal
  grand: AmountParts
  cash: AmountParts
  card: AmountParts
  cashWords: string       // §7.5 — فقط … لا غير
  cardWords: string       // §7.5
  shiftDayName: string    // §7.6 — weekday under ar-SA, PINNED server-side (see §6)
  shiftDayText: string    // §7.6 — yyyy-MM-dd
}
```

**Gone, per 246's sign-off:** `isPosted` (the green POSTED banner was removed — `No.` *is* the posted
state), `varianceText` and `matchedMarkText` (the `خصم فائض` box is **always empty**, a hand-fill
slot), and with them `variance` / `cashRoundingMatched` / `cashRoundingAbsorbed` — 242 §8-O4 is
answered by deletion, not by carrying the flags. `CashRounding.Reconcile` never runs on the receipt
path. Also gone: `currencyCode` — the minor cell sizes to `minor.length` (2 vs 3), not to a lookup.

### 4. The ACR — `{ form, rowsPerPage, pages: AcrPage[] }`

Hoisted header. 243's serialization caveat: every `AcrFormPage` references the **same** `AcrForm`, so
a naive `List<AcrFormPage>` repeats the header *and all rows* once per page.

```ts
type AcrRow = {
  seqText: string          // 1-based, CONTINUOUS across pages
  storeCode: string
  salesDateText: string    // dd/MM/yyyy — per-row, may differ from the header (catch-up ACRs)
  cashText: string         // §7.7 — F{dp} invariant, no separator, no symbol
  cardText: string
  totalText: string
  receiptNoText: string    // NOT zero-padded, unlike the receipt's own No.
  matchText: '' | '✗' | '؟'   // tri-state; '؟' = the Z mirror never synced
  pharmacistName: string
  pharmacistId: string     // 247: OperatorId → pharmacistId; the column is رقم الصيدلي
  notes: string            // Arabic (see §6a); '' when there is nothing to say
  isShortfall: boolean     // 242 §8-O6 answered IN — 247 gave it the mismatch-red warning style
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
  hijriText: string        // 247's NEW field — الموافق, dd/MM/yyyy Umm al-Qura (see §6b)
  acrNumberText: string    // rendered under رقم التجميعي (247), not نموذج رقم ( )
  areas: string
  closedAtText: string     // تاريخ التحصيل — '' while the ACR is still OPEN
  label: string            // الوصف
  status: string           // الحالة — server string, rendered as data
  collectorName: string
  collectorId: string
  cashTotalText: string    // the الاجمالي band's cash column
  cardTotalText: string
  grandTotalText: string
  revenuesText: string     // ملخص التحصيل's ONE remaining row: اجمالي الايرادات
}
```

`rowsPerPage: 22` rides along as documentation of the break rule — **the client never applies it**;
the break is the server's arithmetic (`Paginate(form, 22)`). `pages` is **never empty**: an idle ACR
is one page with `rows: []`.

**Gone, per 247's sign-off:** `depositNumberText`, `depositStatus`, `depositText` — every deposit
mark, meta *and* summary (242 §8-O7 answered OUT), so the ACR says nothing about banking.

### 5. What else leaves the wire (the strings-only trim)

Unrendered by anything, per 242 §4's band-by-band binding table:

| Field | Where | Why |
|---|---|---|
| `storeName` | ACR row | the form prints `رقم الصيدلية` (the code), never the name |
| `variance`, `hasShiftReport` | ACR row | both already collapse into `matchText`'s tri-state |
| `createdAtText` | ACR form | the meta strip shows `عن يوم` + `تاريخ التحصيل` only |
| `currencyCode` | both | a lookup key the client must never need |

If 248 rules the ACR owes a server-side XLSX, that writer binds the **same** strings the form does
(243) — so this trim costs the spreadsheet nothing. If it ever wants `storeName` or the variance
figure, that is a **248 field on a 248 endpoint**, not a re-widening of this contract.

### 6. The three strings the server *authors* (rather than transcribes)

- **(a) `notes` in Arabic.** `Z report missing` is our English literal in an Arabic form (242 §8-O5),
  so the fix belongs in `AcrFormBuilder`, not in a pass-through excuse. It fires on
  `HasShiftReport == false`, which means *the Z mirror never synced to HQ* — not "no Z was run". Mint
  **`تقرير Z غير مُرحّل`**, which pairs with the same row's `؟` (unknown, not wrong); a literal
  `مفقود` would accuse the store of losing something.
- **(b) `shiftDayName` and `hijriText` — pinned formatters with pinned tests.** WPF got the weekday
  from a `ConverterCulture=ar-SA` binding on a Windows desktop
  (`CollectionVoucherControl.xaml:297`); SIS.Api is **net8.0**, a different globalization stack.
  Weekday = `dddd` under `CultureInfo("ar-SA")`; `الموافق` = `dd/MM/yyyy` under an explicit
  **`UmmAlQuraCalendar`**, not merely `ar-SA`'s default. Both go in the builders with **unit tests in
  `Data.Tests`** beside the tafqeet tests — because if globalization degrades the failure is not a
  crash, it is `Thursday` quietly appearing on an Arabic form.
- **(c) The receipt's `—`.** `NoText`'s unposted em-dash stays in the builder (shared with POS) but is
  **unreachable on the web** — the inquiry filters `CollectionStatus = 'COLLECTED'`, and 246 made
  `No.` the posted state itself. A `—` on screen is a bug to chase, not a state to design for.

### 7. A miss

Business refusals in the **envelope**, never a bare 404 — the house answer (`AcrInquiryService` already
throws `DomainException("AcrNotFound", …)`; `LoyWeb` keeps `LOY-00100`) and what `api-envelope` tells
the client to branch on with `apiErrorCode`.

- `AcrForm/{acrId}` unknown → **reuse `AcrNotFound`**. No second code for the same fact.
- `Receipt/{collectionReceiptId}` unknown **or zero rows** → new **`CollectionReceiptNotFound`**
  (on a lookup over the inquiry the two are indistinguishable).
- Both render as the print route's "this document no longer exists" state — **never a blank A4
  sheet**, which prints as convincingly as a real one.
- **Empty is not a miss.** An ACR with no linked collections is a **200, one page, `rows: []`** —
  `Paginate`'s own behaviour and 247's `empty` scenario. Only an unknown id refuses.

### 8. Yes, the frontend starts against a mock — and it is required, not optional

243: every route answers a browser **403** until the doors exist, so the frontend wave cannot make one
live call. **This contract is the mock's spec**, and the two prototype mocks
(`voucher-mock.ts`, `acr-mock.ts`) graduate out of `__prototype__/` into `features/collection/` as
checked-in fixtures, trimmed to the fields above. Their values are **test-pinned** transcriptions of
242 §7 — so a wrong-looking string on screen is a rendering fault, never a fabricated datum.

**Three things the frontend must never assume** (lift these into the spec's Boundaries):

1. **That it may compute any displayed value.** No `toFixed`, no `Intl.NumberFormat`, no `Date`
   formatting, no tafqeet, no page chunking, no deriving `مطابق`/`✗`/`؟`. If a string is not on the
   wire, the answer is a server change, not a client one.
2. **That the mock's *values* are representative.** Its shapes are contractual; its row counts, name
   lengths and totals are not. Arabic names longer than the mock's, a wrapping `areas`, a 3dp
   currency's `005` minor cell, and a row count that lands **one row alone on the last page** must all
   survive — those are 247's scenarios and they stay in the fixture as scenarios, not one happy path.
3. **That live data is ordered or complete like the fixture.** Page order is the server's
   (`OpenedAt` ascending); `pages` is never empty but `rows` may be; `closedAtText`, `notes`,
   `pharmacistName` and `pharmacistId` are all legitimately `''`.

**The first live call is a wave-joining event with its own verification**, not a checkbox. The fixture
proves rendering; it cannot prove the door, the grant, or `ar-SA` resolving on net8.0/IIS.

### 9. The backend wave, as this contract sizes it

1. `CollectionWebEndpoints.cs` — one file, seven routes, cookie-marked, four grant filters (likely one
   parameterised gate over `BackOfficeScreen[CONTROLLER,'03']`, following `OmsGrantEndpointFilterBase`).
   Expect the known net472/net8.0 CS1705 skew and dodge it the way `DepositEndpoints.AddServices`
   already documents.
2. `CollectionReceiptId` onto the inquiry projection, model and options (§2).
3. Two strings-only mappers (one per document) — the mocks are their spec.
4. `MarkPosted` over the page set on the receipt door, `OpenedAt`-ascending order (§3).
5. `AcrFormBuilder`: `OperatorId` → `PharmacistId`, deposit fields out, `hijriText` in, `notes` in
   Arabic (§4, §6).
6. Pinned `Data.Tests` for the two culture-formatted strings (§6b).

**Zero new SQL** beyond the one added SELECT column.
