# 243 — What the server already hands over

Research asset for wayfinder ticket [243](../243-what-the-server-already-hands-over.md), map
[240 — The collection documents come to the web](../240-the-collection-documents-come-to-the-web.md).

Source of truth read on 2026-08-07 from `C:\Work\DMSCO\BackOffice` at its then-current state. Every
path below is relative to that repo root.

---

## 0. The headline

| Question | Answer |
|---|---|
| Is the data for both documents already reachable? | **Yes, both, with no second fetch and no new query.** The receipt is a pure map off one `PosCollection/CollectionInquiry` row; the ACR form's builder input is *exactly* `Acr/Report`'s return type. |
| Where do the builders live relative to SIS.Api? | **Inside a project SIS.Api already references.** `SIS.Api.csproj` has `<ProjectReference Include="..\..\Sartawi.Retail.Data\Sartawi.Retail.Data.csproj" />`, and both builders are compiled members of that project. **"Add an endpoint", not "port the builders."** |
| Is the browser allowed in? | **No. All four screens are shut today.** Issue 802 closed `ApiKeyEndpointFilter`'s cookie branch by default; none of the four endpoint files calls `.AllowCookieSession()`, so a browser gets a bare **403**. Deposit is worse — it rides `CollectorEndpointFilter`, which has no cookie branch at all. |

So the backend wave is **not** "expose the builders" alone — it is **"build the web door"**: a
`*WebEndpoints.cs` per surface, grant-gated and cookie-marked, following the exact pattern
`LoyWebEndpoints` / `BbyInquiryWebEndpoints` / `CallCenterWebEndpoints` already set. The builders
themselves are a two-line call inside that new door.

---

## 1. The four existing contracts

All four live under `Services\SIS.Api\Endpoints\Pos\`, are auto-discovered via `IEndpoints`
(no central registration list), and their route path is `Tag + "/" + method`.

### 1.1 `PosCollection/CollectionInquiry` — Collection Inquiry

- **File:** `PosCollectionEndpoints.cs` (Tag `PosCollection`), `MapGet`, filter
  `ApiKeyEndpointFilter`, **no** `AllowCookieSession()`.
- **Binding:** `[AsParameters] CollectionInquiryOptions` — query-parameter names **must equal the
  property names** (the house "101 idiom"). Properties:

  | Param | Type | Note |
  |---|---|---|
  | `StoreId` | `string` | optional; unset matches all |
  | `CollectorOperatorId` | `string` | optional |
  | `AcrId` | `string` | **the 112 drill-down** — exact-ACR filter fed by the ACR screen's "Detail" button; unset matches all |
  | `FromDate` / `ToDate` | `DateTime?` | applied to `PosCollectionReceipt.CollectedAt` |
  | `Limit` | `int?` | WPF controller defaults it to **200** client-side; the server has no default of its own |

- **Response:** `List<CollectionInquiryModel>` (via the universal envelope). Fields, verbatim:

  `StoreId`, `OpenedAt`, `ClosedAt?`, `SystemCash`, `CountedCash`, `Variance`,
  `VarianceReasonCode`, `VarianceReasonText`, `OpeningFloat`, `CountedCashNet`, `RetainedFloat`,
  `NetCollected`, `CardTotal`, `CardTransactionCount`, `CollectorOperatorId`,
  `CollectionReceiptNo`, `CollectedAt`, `ZReportIds`, `CollectorName`, `StoreName`,
  `CloserOperatorId`, `CloserName`, `SalesDate`, `CurrencyKey`.

  Names (`CollectorName`, `StoreName`, `CloserName`) and `CurrencyKey` are **already resolved
  server-side** — the web does not need a staff or store master lookup.

- **The drill-down is one screen, not two.** The ACR screen's Detail button just re-calls this same
  endpoint with `AcrId` set. No separate route.

### 1.2 `Acr/*` — ACR Inquiry

`AcrEndpoints.cs` (Tag `Acr`), all `ApiKeyEndpointFilter`, none cookie-marked. Nine routes; the web
needs **two**:

| Route | Verb | Needed by web? | Why |
|---|---|---|---|
| `Acr/Inquiry` | GET | **YES** | The HQ grid. `[AsParameters] AcrInquiryOptions`, not collector-scoped. |
| `Acr/Report` | GET | **YES** | The printable form. `[FromQuery] string acrId`, not collector-scoped. |
| `Acr/My`, `Acr/MyReport`, `Acr/Open`, `Acr/Total` | GET | no | **Claim-scoped to the till's collector** (`httpContext.GetUserAction().StaffId`). Wrong audience: a supervisor viewing another collector's ACR would get `AcrNotFound`. |
| `Acr/Create`, `Acr/Close` | POST | no | Write actions — already out of scope on the map. |
| `Acr/Unlinked` | GET | no | An advisory ops/monitoring surface (mirrored receipts still unlinked past SLA). Not one of the four screens. Candidate for a future "collection health" screen; noted, not proposed. |

**`AcrInquiryOptions`** (query params): `AcrId`, `CollectorOperatorId`, `Status` (`""` | `"OPEN"` |
`"CLOSED"`), `FromDate?`, `ToDate?` (window on `AcrDate`, To-day inclusive), `Limit?`.

**`AcrInquiryModel`** (grid row): `AcrId`, `AcrNumber`, `Label`, `CollectorOperatorId`,
`CollectorName`, `AcrDate`, `Status`, `CreatedAt`, `ClosedAt`, `LinkedCollectionCount`,
`NetCollectedTotal`, `CardTotalSum`, `CardTransactionCountSum`, `DepositId`, `DepositNumber`,
`DepositStatus`.

**`AcrReportModel`** = `{ Acr: AcrInquiryModel, Areas: string, Rows: List<AcrReportRowModel> }`.
`AcrReportRowModel`: `CollectionReceiptId`, `StoreId`, `StoreName`, `Area`, `SalesDate`,
`NetCollected`, `CardTotal`, `CardTransactionCount`, `RetainedFloat`, `CollectionReceiptNo`,
`CollectedAt`, `CoveredShiftCount`, `HasShiftReport`, `SystemCash`, `CountedCash`, `OpeningFloat`,
`Variance`, `VarianceReasonCode`, `VarianceReasonText`, `CloserOperatorId`, `CloserName`,
`CurrencyKey`, `IsShortfall` (derived: `NetCollected < 0`).

### 1.3 `Deposit/Inquiry` — Deposit Inquiry

- **File:** `DepositEndpoints.cs` (Tag `Deposit`). **Every route is `CollectorEndpointFilter`**, not
  `ApiKeyEndpointFilter`. The web needs `Deposit/Inquiry` only (`Deposit/My`, `/Get`,
  `/EligibleAcrs` are claim-scoped to the phone's collector; `/Create`, `/Void` are writes;
  `/Banks`, `/Reasons` are pickers a read-only grid may want for filter labels).
- **`DepositInquiryOptions`:** `DepositId`, `CollectorOperatorId`, `BankCode`, `Status`
  (`""` | `"POSTED"` | `"VOID"`), `FromDate?`, `ToDate?` (on `DepositedAt`), `Limit?`.
- **Response:** `DepositInquiryResultModel` = `{ Rows: List<DepositInquiryRowModel>,
  Balances: List<DepositCollectorBalanceModel> }` — note it is **not a bare list**; the grid comes
  with a per-collector balance summary attached.
  - `DepositInquiryRowModel` carries the deposit header plus `Lines: List<DepositInquiryLineModel>`
    and `Attachments: List<DepositAttachmentModel>`. Each line has `NetCollectedAtDeposit` (frozen)
    vs `NetCollectedNow` (live) and derived `Drift` / `HasDrift`.
  - `DepositCollectorBalanceModel`: `CollectorOperatorId`, `CollectorName`, `DepositCount`,
    `TotalCalculated`, `TotalReal`, `Outstanding`.
- **No printable document** on this surface. The WPF `DepositInquiry` folder has no form/printer
  pair analogous to `CollectionVoucherControl` or `AcrFormControl`. Attachments are **URLs the
  mobile backend hosts** (`DepositAttachmentModel.Url`) — the API never takes or serves bytes.

### 1.4 `CollectionAttempt/Inquiry` — Collection Attempts

- **File:** `CollectionAttemptEndpoints.cs` (Tag `CollectionAttempt`), one `MapGet`,
  `ApiKeyEndpointFilter`, not cookie-marked. Not collector-scoped.
- **`CollectionAttemptInquiryOptions`:** `CollectorStaffId`, `StoreCode`, `ReasonCode`,
  `FromDate?`, `ToDate?` (on `AttemptTime`, the device clock), `Limit?`.
- **`CollectionAttemptInquiryModel`:** `AttemptId`, `CollectorStaffId`, `CollectorName`,
  `StoreCode`, `StoreName`, `ShiftId`, `BusinessDay`, `AttemptTime`, `ReasonCode`, `ReasonText`.
- The simplest of the four: one flat list, no document, no drill-down.

---

## 2. Q1 — Is the data for both documents already reachable?

### Receipt (سند قبض): **yes, exactly as the map assumed.**

`CollectionVoucherBuilder.FromInquiryRow(CollectionInquiryModel row)`
(`Sartawi.Retail.Data\Modules\Pos\Services\Voucher\CollectionVoucherBuilder.cs:128`) is **pure row
mapping** — it takes one inquiry row and returns one `CollectionVoucherModel`. No I/O, no second
fetch, no name resolver argument (unlike `BuildPages`, which needs a `Func<string,string>
resolveStaffName`; `FromInquiryRow` doesn't, because the 101 spine already resolved names into the
row). It ends by calling `MarkPosted`, which stamps `No` / `IsPosted` / `CollectedAt`.

Its own comment states the reasoning: *"The 101 spine already resolved names + currency server-side
and each row is one collected shift, so no reconstruction is needed."*

Two degradations are already handled inside it and must not be re-implemented client-side:
- pre-107 rows carry `NetCollected = 0` → `CountedCashNet` stands in;
- pre-shift-day rows carry `SalesDate = 0001-01-01` → `ClosedAt.Date` (else `CollectedAt.Date`) stands in.

> **⚠ Fidelity finding — the مطابق mark is missing on the HQ path.**
> `FromInquiryRow` never sets `CashRoundingMatched` / `CashRoundingAbsorbed` (only `BuildPages`
> does, via `CashRounding.Reconcile`). Both therefore stay `false`/`0`, so the derived
> `CashRoundingApplied` is always `false` and `MatchedMarkText` is always `""` — the **"مطابق"**
> box never renders on an HQ-sourced receipt, while it does on a POS-sourced one. The web facsimile
> will faithfully reproduce the *HQ* WPF output (which has the same gap, since the HQ WPF host also
> goes through `FromInquiryRow`), but **not** the POS one. This must be surfaced at the
> side-by-side sign-off gate so the user rules deliberately: reproduce the HQ behaviour, or fix the
> builder to recompute rounding on this path too. It is a one-line-ish builder change if wanted —
> `CollectionInquiryModel` carries `SystemCash`, `CountedCash` and `CurrencyKey`, everything
> `CashRounding.Reconcile` needs.

### ACR form: **yes — an exact type match.**

`AcrFormBuilder.Build(AcrReportModel report)` takes **precisely** the type
`AcrInquiryService.GetAcrReportAsync` returns, which is precisely what `Acr/Report` responds with.
There is no adapter, no missing field, no second call. `Acr/Report` → `AcrFormBuilder.Build` →
`AcrFormBuilder.Paginate(form, rowsPerPage: 22)` is the whole chain.

`Paginate` has **no fixed row cap** and always yields at least one page (an idle ACR still prints
one). `ShowSummary` is true only on the last page — the totals row, the ملخص التحصيل box and the
signature strip render once, at the end. Every `AcrFormPage` shares the **same `AcrForm` instance**
(see §4 for the JSON consequence).

### Both builders already carry the presentation layer

This is the strongest support for the map's "React renders a print-ready model" decision. The
formatting is *already* server-side, as computed getters:

- `CollectionVoucherModel`: `NoText`, `GrandParts`/`CashParts`/`CardParts`
  (`VoucherAmountParts { Whole, Minor }` — the S.R.|H. digit-box splits, minor zero-padded to the
  currency's decimal places), `CashWords`/`CardWords` (**Arabic tafqeet**, via `ArabicTafqeet`),
  `VarianceText` (`"فائض 12.50"` / `"عجز 3.00"` / `""`), `MatchedMarkText`.
- `AcrForm` / `AcrFormRow` / `AcrFormPage`: `AcrNumberText`, `AcrDateText`, `DepositNumberText`,
  `CreatedAtText`, `ClosedAtText`, `CashTotalText`, `CardTotalText`, `GrandTotalText`,
  `RevenuesText`, `DepositText`; per row `SeqText`, `SalesDateText`, `CashText`, `CardText`,
  `TotalText`, `ReceiptNoText`, `MatchText` (tri-state: `""` matched / `"✗"` real diff /
  `"؟"` Z mirror never synced); per page `PageText` (`"2 / 3"`).

Money formatting is invariant-culture `F{decimals}` with decimals from `VoucherCurrency` (SAR 2,
BHD/KWD/OMR 3); dates are invariant `dd/MM/yyyy`. **The React facsimiles should format nothing.**

---

## 3. Q2 — Where do the builders live relative to SIS.Api?

**No wall. SIS.Api already references the assembly, and the endpoints already resolve services from it.**

- `Services\SIS.Api\SIS.Api.csproj` → `<ProjectReference Include="..\..\Sartawi.Retail.Data\Sartawi.Retail.Data.csproj" />`.
- `Sartawi.Retail.Data.csproj` compiles all five voucher files explicitly (old-style csproj):
  `AcrFormBuilder.cs`, `ArabicTafqeet.cs`, `CollectionVoucherFormat.cs`, `CollectionVoucherModel.cs`,
  `CollectionVoucherBuilder.cs`.
- The existing endpoints already inject `PosCollectionInquiryService`, `AcrInquiryService`,
  `DepositInquiryService`, `PosCollectionAttemptInquiryService` — all registered in Retail.Data's
  own DI extensions.

**The one wrinkle, already lived with:** `Sartawi.Retail.Data` is **net472**
(`<TargetFrameworkVersion>v4.7.2</TargetFrameworkVersion>`, old-style csproj) while `SIS.Api` is
**net8.0**. This is a known, tolerated skew — `DepositEndpoints.AddServices` documents it explicitly:
the void guard is registered "behind an object-typed `Register()` to dodge the net462/net8 CS1705
skew". So the pattern is proven, but a new endpoint that drags in a *new* dependency edge should
expect CS1705 and follow the same object-typed-boundary dodge.

Both builders are **`static`, pure, and dependency-free** (`CollectionVoucherBuilder` is a static
class; `AcrFormBuilder` is a static class taking a POCO). They cross the TFM boundary as plain
method calls on plain types — no DI, no NHibernate, no `System.Drawing`. **Sizing: this is
"add an endpoint".**

---

## 4. Serialization note (affects the print-ready model contract)

`System.Text.Json` serializes **get-only properties by default**. So an endpoint returning
`CollectionVoucherModel` or `List<AcrFormPage>` ships every computed presentation string —
tafqeet, digit-box splits, `MatchText`, `PageText` — to the browser **for free, with no DTO work**.
That makes the map's print-ready-model decision nearly zero-cost server-side.

Two caveats for whoever designs the contract:

1. **`VoucherAmountParts` has no parameterless constructor and only get-only properties.** It
   serializes out fine (that is all the web needs, one-way), but it is **not deserializable**
   round-trip without `[JsonConstructor]`. Irrelevant for a read-only web client; relevant if
   anything server-side ever tries to round-trip it.
2. **`AcrFormPage.Form` is the same object on every page.** Serializing `List<AcrFormPage>` repeats
   the whole header + summary + `Form.Rows` (**all** rows, not the page slice) once per page. Not a
   cycle — it terminates — but on a 3-page ACR it triples the payload and duplicates every row.
   The contract should either return `{ form, pages: [{ rows, pageIndex, pageCount, showSummary }] }`
   with the form hoisted once, or apply `[JsonIgnore]` on `AcrFormPage.Form`. **Worth deciding
   explicitly at contract time** rather than discovering it as payload bloat.

---

## 5. Q3 — Is the browser allowed in? **No.**

### The default-deny

Issue 802 (`Services\SIS.Api\Auth\CookieSessionEligibility.cs`) inverted the model. Verbatim from
the file: `ApiKeyEndpointFilter` is *"cookie-session OR api-key, not api-key-only"*, so before the
fix **394 routes** were callable by any signed-in back-office session with no grant check at all.
The fix closed the cookie branch by default; it opens one endpoint at a time via
`.AllowCookieSession()`.

The refusal is a **bare 403, not a 401** — deliberately, because oms-react's `core/api.ts` treats
401 as session-expired and logs the user out, and *"a missed marker must break one screen, never the
whole tab."* It is decided **before** the CSRF header check and before the session lookup.

### Status of our four

I grepped every `.AllowCookieSession()` call site in `Services\SIS.Api\Endpoints\`. The marked files
are: `AuthzAdminWebEndpoints`, `UaAdminWebEndpoints`, `UaSessionsWebEndpoints`,
`CallCenterWebEndpoints`, `CallCenterWebSessionEndpoints`, `CouponsAdminWebEndpoints`,
`NphiesEndpoints`, `NphiesSessionEndpoints`, `BbyInquiryWebEndpoints`,
`BonusBuyDownloadWebEndpoints`, `PricingEndpoints`, `LoyWebEndpoints`, `NotificationEndpoints`,
`RetailInvoiceWebEndpoints`, `SdDocumentEndpoints`.

**None of `PosCollectionEndpoints`, `AcrEndpoints`, `DepositEndpoints`, or
`CollectionAttemptEndpoints` appears.** All four screens answer a browser **403** today.

Deposit is a harder no: `CollectorEndpointFilter` requires `x-api-key` **and** an
`Authorization: Bearer` session whose `Channel` is **`Mobile`** — it explicitly rejects a
browser-minted token (*"A token minted for the browser is not a collector credential"*). There is
**no cookie branch in that filter at all**, so `.AllowCookieSession()` on a Deposit route would do
nothing. Deposit Inquiry needs a genuinely new door, not a marker.

### The pattern to copy

Every web surface in this codebase is a **sibling `*Web/*` door**, not a marker bolted onto the
integration route. `BbyInquiryGrantEndpointFilter` is the cleanest recent example and the closest
analogue (an inquiry screen, map 598 / spec 599):

```
app.MapGet("BbyWeb/List", …)
   .AddEndpointFilter<ApiKeyEndpointFilter>()      // fills UserId from the session row
   .AddEndpointFilter<BbyInquiryGrantEndpointFilter>()  // enforces the screen grant, 403 fail-closed
   .AllowCookieSession();                          // opens the cookie branch
```

The grant filter reads `context.HttpContext.GetUserAction().User` and asks an `I…ScreenGate` for
`BackOfficeScreen[CONTROLLER='<name>', COMMAND='03']`. It is **fail-closed**: no UserId (api-key
caller, or `CookieAuth:Enabled=false`) or no grant → 403 `ACCESS_DENIED`. Its doc comment is
emphatic that this filter is the real boundary and the `…/Access` probe *"only hides the screen"* —
so the web needs **both**: the gate on every read, and an `Access` probe for the menu.

### The permission names — a clean 1:1

Each WPF controller calls `Permissions.Check(ControllerID, Permissions.Activity.Display)`, and the
`ControllerID` values are:

| Screen | WPF `ControllerID` | Proposed web grant |
|---|---|---|
| Collection Inquiry | `"CollectionInquiry"` | `BackOfficeScreen[CollectionInquiry, 03]` |
| ACR Inquiry | `"AcrInquiry"` | `BackOfficeScreen[AcrInquiry, 03]` |
| Deposit Inquiry | `"DepositInquiry"` | `BackOfficeScreen[DepositInquiry, 03]` |
| Collection Attempts | `"CollectionAttempts"` | `BackOfficeScreen[CollectionAttempts, 03]` |

`03` is the Display command in the same new-engine convention `BbyInquiry` uses. `DepositInquiry`'s
controller comment already notes *"seed 021 supplies the menu row + grant (UserID 'ADMIN' …)"* — so
grants under these exact controller names **already exist** in the WPF seed. The web wave should
reuse those names rather than mint parallel ones, which makes the collection supervisor / accountant
question mostly an **existing-grant-assignment** matter, not a new permission design.

> **Open, for a grilling ticket not this one:** whether "collection supervisor" and "accountant" get
> the *same* four grants or a split (e.g. accountant sees Deposit + ACR, supervisor sees Attempts +
> Collection), and whether the ACR/receipt *print* action deserves its own command beyond Display.
> The WPF makes no such distinction — one Display check opens the screen and every button on it.

---

## 6. What this means for the backend wave's size

Six items, all in `C:\Work\DMSCO\BackOffice`, none requiring a new query or projection:

1. **`PosCollectionWebEndpoints.cs`** — `PosCollectionWeb/Inquiry` (delegating to the existing
   options + service) + `PosCollectionWeb/Access` probe, behind a new
   `CollectionInquiryGrantEndpointFilter`.
2. **`PosCollectionWeb/Receipt`** — `[FromQuery] receiptNo`-or-equivalent → run the existing
   inquiry with the narrowing filter, `CollectionVoucherBuilder.FromInquiryRow`, return the
   print-ready model. *(Exact key to address one receipt is a contract question — `CollectionInquiryOptions`
   has no `CollectionReceiptNo` filter, only Store/Collector/Acr/date/limit. Flagged in §7.)*
3. **`AcrWebEndpoints.cs`** — `AcrWeb/Inquiry` + `AcrWeb/Report` (the latter running
   `Build` → `Paginate` and returning pages) + `AcrWeb/Access`, behind `AcrInquiryGrantEndpointFilter`.
4. **`DepositWebEndpoints.cs`** — `DepositWeb/Inquiry` (+ `Banks`/`Reasons` if the filter bar wants
   labels) + `DepositWeb/Access`, behind `DepositInquiryGrantEndpointFilter`. **This one cannot
   reuse the existing route's filter at all** — new door, `ApiKeyEndpointFilter` + grant + marker.
5. **`CollectionAttemptWebEndpoints.cs`** — `CollectionAttemptWeb/Inquiry` + `Access`, behind
   `CollectionAttemptsGrantEndpointFilter`.
6. **Four screen gates** (`I…ScreenGate` + impl) or one parameterised gate over
   `BackOfficeScreen[CONTROLLER, '03']` — the four filters are otherwise identical, so a shared base
   like the existing `OmsGrantEndpointFilterBase` is the obvious shape.

That is meaningfully **larger than "expose the builders"** — the builders are two call sites inside
it — but it is entirely boilerplate the codebase has done five times already (Loy, Bby, CallCenter,
Coupons, RetailInvoice), with zero new SQL.

---

## 7. Facts that graduated out of this ticket

Things this research settled or newly exposed, for the map to absorb:

- **New blocking dependency:** the frontend wave cannot make a single live call until the web doors
  exist. Mocked envelopes (the Loy pattern) are the only way to run the two waves in parallel — this
  answers part of the map's *"How the two waves are sequenced"* fog: **mocking is not a preference,
  it is required**, because 403 is the *only* answer a browser gets today.
- **New, unticketed contract question:** *how does the web address one receipt?*
  `CollectionInquiryOptions` can filter by store/collector/ACR/date/limit but **has no
  `CollectionReceiptNo` or `CollectionReceiptId` filter**. The WPF opens the voucher from a grid row
  it already holds in memory — the web, if it wants a deep-linkable `/receipt/:no` URL, needs either
  a new option field (a real, if tiny, server change) or must accept that the receipt is only
  reachable from a loaded grid. **This is the one place the "no new query" claim is strained.**
- **Fidelity risk to raise at the sign-off gate:** the مطابق mark (§2) is absent on the HQ path.
- **Deposit carries no printable document** — answering half of the map's *"Deposit Inquiry and
  Collection Attempts in detail"* fog. It has instead: attachment URLs, and a per-collector
  `Balances` summary alongside the rows (an unusual shape — the grid is not a bare list).
- **Collection Attempts is the smallest screen** — flat list, six filters, no document, no
  drill-down. It does not justify a wave of its own.
- **`Acr/Unlinked`** exists as an ops/monitoring surface (mirrored receipts unlinked past SLA).
  Outside the four screens; noted for a possible future "collection health" screen, not proposed here.
- **Export parity input:** `AcrFormExcelWriter` binds the *same* `AcrForm`/`AcrFormPage` presentation
  strings the WPF control does. So if the web owes XLSX, a server-side writer already has its input
  in hand — the export question is genuinely downstream of the print-path decision, as the map says.
