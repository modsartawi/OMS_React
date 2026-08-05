# 223 — What the four Loy reads actually return

Field inventory for the read-only Loy member screen (map 222), taken **from source** in
`C:\Work\DMSCO\BackOffice` on 2026-08-05. Every field below was read off a C# class, a SQL string,
or a WPF view — nothing is inferred from naming.

Sources read:

- `Services/SIS.Api/Endpoints/Loy/LoyEndpoints.cs` (routes + handlers)
- `Services/SIS.Api/Endpoints/Helpers/EndpointHelpers.cs` (the envelope)
- `Sartawi.Retail.Data/Modules/Loy/Services/LoyMemberService.cs`
- `Sartawi.Retail.Data/Modules/Loy/Services/Models/LoyMemberModel.cs`
- `Sartawi.Retail.Data/Modules/Loy/Extensions/ModelMapping.cs`
- `Sartawi.Retail.Data/Modules/Loy/Services/Reports/LoyReportService.cs` (the raw SQL)
- `.../Reports/Models/LastActivityModel.cs`, `.../Reports/Models/LoyaltySalesLine.cs`
- `.../Reports/ActionReport/{LoyMemberActionParams,LoyMemberActionModel,LoyMemberActionReport,LoyMemberActionReportResult}.cs`
- `Sartawi.Retail/IC/{ViewModels,Views}/` — `Search`, `Account`, `Points`, `Sales`, `MemberActions`
- `Sartawi.Retail.Data/Modules/Oms/OmsHttpService.cs` (how WPF actually calls these)

---

## 0. The envelope, and what a miss looks like

All five reads go through `EndpointHelpers.ExecuteAsync`, so **the standard envelope holds** and
`core/api.ts` unwraps it unchanged:

```
200  { statusCode: 200, success: true,  message: "", errors: null, data: <T> }
400  { statusCode: 400, success: false, message: "<domain message>",
       errors: [ { errorMessage, errorCode, internalErrorCode } ] }   // data absent
```

Only `DomainException` is converted; **any other exception is rethrown** (`catch (Exception) { throw; }`)
and surfaces as a 500 with no envelope. A SQL timeout on a big Sales query is therefore a raw 500,
not a business refusal.

**Member not found is a 400 business outcome, not a 404 and not a null `data`.**

| Endpoint | member missing | other refusals |
|---|---|---|
| `Loy/Member/{loyId}` | `LOY-00100` `"Customer {loyId} doesn't exists"` | `LOY-00101` `"Customer {loyId} archived"` when `MemberType == Archived` |
| `Loy/MemberByMobile/{mobile}` | `LOY-00100` `"Customer with {mobile} doesn't exists"` | **no archived check** — an archived member resolves fine by mobile |
| `Reports/LastActivities/{loyId}` | **200 with `data: []`** — raw SQL, no existence check | — |
| `Reports/LoyaltySales/{loyId}` | **200 with `data: []`** — same | — |
| `Reports/LoyMemberActions` | **200 with an empty `Records`** page | — |

Consequence for the screen: **only the member read can fail on a bad key.** The three tabs cannot
distinguish "no such member" from "member with no rows" — the member call is the gate, and it is the
only place a not-found message can come from.

Codes come from `Modules/Loy/Constants/LoyaltyErrorCodes.cs`; the two this screen can meet are
`LOY-00100` (`CustomerNotExists`) and `LOY-00101` (`CustomerArchived`).

---

## 1. `GET Loy/Member/{loyId}` and `GET Loy/MemberByMobile/{mobile}` → `LoyMemberModel`

Both take an optional **`branchId`** query param. `MemberByMobile` is wrapped in `FusionCache` for
**45 s**, keyed `Loy_LoyMemberByMobile_{mobile}_{branchId ?? ""}`; `Member` is not cached.

### Every field

C# has no nullable annotations here — every `string` is a plain reference type, so **treat all
strings as nullable in TypeScript.** "Source" says where the value comes from.

| Field | C# type | TS | Source / note |
|---|---|---|---|
| `LoyId` | `string` | `string` | the member key |
| `MobileCountry` | `string` | `string \| null` | dialling country, separate from `Mobile` |
| `Mobile` | `string` | `string \| null` | stored **with** the dialling code (WPF searches `966` + input) |
| `FullName` | `string` | `string \| null` | |
| `BirthDate` | `DateTime` | `string` | **not nullable** — an unset birthdate arrives as a sentinel date (`0001-01-01` / the codebase's `EmptyDate()`), never null. Must be guarded before display. |
| `Gender` | `string` | `string \| null` | a **code** (see `GenderConst.cs`), not a word |
| `Email` | `string` | `string \| null` | |
| `Nationality` | `string` | `string \| null` | code |
| `NationalId` | `string` | `string \| null` | **PII** |
| `InsuranceCompany` | `string` | `string \| null` | |
| `CityCode` | `string` | `string \| null` | **code only — no city name.** The member read never joins `LoyCity`; WPF's Account view labels it "City" and shows the raw code. |
| `PreferredLanguage` | `string` | `string \| null` | |
| `JoinDate` | `DateTime` | `string` | from **`LoyMembership.JoinDate`**, not the member row |
| `LastUpdate` | `DateTime` | `string` | `LoyMember.UpdatedAt` |
| `Tier` | `string` | `string \| null` | `"S" \| "G" \| "P"` — code, not "Silver" |
| `TierPointsBalance` | `decimal` | `number` | from membership |
| `PendingPoints` | `decimal` | `number` | from membership |
| `PointsBalance` | `decimal` | `number` | from membership — the headline number |
| `PointsBalanceAmount` | `decimal` | `number` | **derived**: `floor(PointsBalance / 22.2222222222)`, then currency-converted if `branchId` given |
| `PointsBalanceAmountCurrency` | `string` | `string` | `"SAR"` unless `branchId` resolves a non-SAR plant |
| `PointsExpireSoon` | `decimal` | `number` | separate repository read, `Math.Floor`-ed; `0` when nothing expires |
| `PointsExpireSoonDays` | `int` | `number` | **always `30`** — a constant default, never assigned |
| `ExchangeRate` | `decimal` | `number` | `1` unless `branchId` given and the plant currency ≠ SAR |
| `ProfileUpdated` | `bool` | `boolean` | |
| `Profile` | `string` | `string` | **always `"W|D"`** — the default is never overwritten by any mapping. Dead field; do not show it. |
| `AccrualFactor` | `decimal` | `number` | hardcoded per tier: S `0.285714286`, G `0.428571429`, P `0.571428571` |
| `RedemptionFactor` | `decimal` | `number` | **always `22.2222222222`** — hardcoded in `MapMembership` |
| `BlockedReason` | `string` | `string \| null` | **the reason *code*, not its description.** Null/empty ⇒ the member is not blocked. |

### What `branchId` changes — and what the portal should pass

`branchId` does **exactly one thing** (`LoyMemberService.FillBalance`): look up the plant's currency
for that branch, get today's exchange rate against SAR, and if the rate is neither `0` nor `1`,
restate `PointsBalanceAmount` in that currency and set `ExchangeRate` / `PointsBalanceAmountCurrency`.
It changes **no other field**, and it never affects the points balance itself.

**Recommendation: pass nothing.** All KSA branches are SAR, so passing the acting store is a no-op
that only widens the cache key and adds two lookups. Omitting it yields `SAR` / rate `1` — the
honest default for a back-office read. (WPF passes nothing either: `OmsHttpService` calls
`Loy/Member/{loyId}` and `Loy/MemberByMobile/{mobile}` bare.) If the effort ever wants the
non-SAR case, that is a phase-2 decision, not a phase-1 param.

### The 45-second cache

`MemberByMobile` can return a member up to 45 s stale; `Member` is always fresh. Since phase 1
changes nothing about the member, this is harmless — but it does mean **re-searching the same mobile
does not re-read the database**, which matters if the screen ever grows a refresh affordance.

### Member status is a code with no decoder on this call

`BlockedReason` is a code; its English lives behind `GET Loy/MemberBlockedReasons` (→
`List<LoyMemberBlockedReason>` with `ReasonCode` / `Description`), which WPF loads once and caches
statically. Same for `Gender`, `Nationality`, `CityCode`, `Tier` — **the member read hands over
codes and no lookup tables.** WPF's Account view derives its "Status" field as simply
`BlockedReason.IsNullOrEmpty() ? "Active" : "Blocked"`.

---

## 2. `GET Loy/Reports/LastActivities/{loyId}` → `LastActivityModel[]`

The SQL (`LoyReportService.LastActivitySQL`) verbatim in shape:

```sql
SELECT TOP (100) ... FROM LoyActivity WITH (NOLOCK)
INNER JOIN LoyActivityType ON LoyActivity.ActivityType = LoyActivityType.ActivityType
WHERE LoyActivity.LoyId = @LoyId
ORDER BY LoyActivity.ActivityId DESC
```

- **A row is one loyalty activity** — an accrual, a redemption, an adjustment, a cancellation.
- **Capped at 100, hard.** Not paged, no total count, no "there are more" signal. `TOP (100)` +
  `ORDER BY ActivityId DESC` means *the 100 most recently created activities*, and the client cannot
  tell a member with exactly 100 from a member with 4,000.
- **Order is by `ActivityId DESC`, not by date.** Insertion order, which is *usually* chronological
  but is not guaranteed to be — a backdated posting sorts by when it was written, not when it
  happened.
- **`INNER JOIN LoyActivityType`** — an activity whose type is missing from the type table
  **silently disappears from the list.**

### Fields

| Field | C# type | Note |
|---|---|---|
| `ActivityType` | `string` | code (`ACRL`, `RDEM`, `RDCN`, `ADJC`, `FRSN`, …) |
| `Description` | `string` | **the type's English, joined from `LoyActivityType.Description`** — this is the decoded label, and it is server-supplied text |
| `ActivityDateTime` | `DateTime` | when it happened |
| `ActivityDateTimeString` | `string` (computed) | `"yyyy-MM-dd HH:mm:ss"` — **serialized too** (get-only properties are emitted by System.Text.Json) |
| `LoyId` | `string` | |
| `RefLoyId` | `string` | the *other* member on a transfer |
| `ActivityId` | `string` | the key, and the sort |
| `RelatedActivityId` | `string` | the original, on a reversal/cancellation |
| `ActivityStatus` | `string` | `A` added · `P` posted · `N` pending · `E` error (`LoyActivityStatusConstants`) — **code, no description joined** |
| `EffectiveTime` | `DateTime` | mapped from `LoyActivity.PendingUntil` — when a pending accrual becomes real |
| `EffectiveTimeString` | `string` (computed) | **empty string when `EffectiveTime < 2000-01-01`** — the server's own way of saying "unset" |
| `ExpiryDate` | `DateTime` | |
| `ExpiryDateString` | `string` (computed) | **empty string when `Points <= 0`** — expiry is only meaningful on a credit |
| `Points` | `decimal` | mapped from **`LoyActivity.SpendPoints`** |
| `TierPoints` | `decimal` | |
| `ReferenceNumber` | `string` | the till receipt / source document |
| `BranchId` | `string` | code, no branch name |
| `PointsAmount` | `decimal` | |
| `SalesAmount` | `decimal` | |
| `SpendPointsFactor` | `decimal` | |
| `PointsAmountInCurrency` | `decimal` | |
| `Currency` | `string` | |

**What `Points.Round()` implies.** The endpoint runs `activity.Points = activity.Points.Round()` over
every row before returning; `Round()` (`Sartawi.Extensions/Extensions.cs`) is
`decimal.Round(value, 2, MidpointRounding.AwayFromZero)`. So the **stored** `SpendPoints` carries more
than two decimals, and the client receives a value already rounded to 2 dp away-from-zero. Do **not**
re-round or re-sum in the browser: a client-side total of the rounded rows will not equal
`PointsBalance`. The three sibling decimals (`TierPoints`, `PointsAmount`, `SalesAmount`,
`SpendPointsFactor`, `PointsAmountInCurrency`) are **not** rounded and can arrive with long tails.

The pre-formatted `*String` fields are a WPF convenience. The web should format from the `DateTime`
fields itself — **except** that the two emptiness rules above (`< 2000-01-01` ⇒ unset,
`Points <= 0` ⇒ no expiry) are domain rules the raw fields don't carry, so they must be
re-implemented client-side or the `*String` fields used.

---

## 3. `GET Loy/Reports/LoyaltySales/{loyId}` → `LoyaltySalesLine[]`

```sql
SELECT TOP (500) RetailTrxDetail.StoreCode, TrxNumber, UnitPrice, QuantityValue AS Qty,
       AmountValue AS Amount, Currency, ItemNumber, Item.Description AS ItemDescription,
       TrxDate, LoyaltyCustomerID, TrxType AS TrxTypeNumber, DocumentType AS DocumentTypeNumber
FROM RetailTrxDetail WITH (NOLOCK)
INNER JOIN Item ON RetailTrxDetail.Client = Item.Client AND RetailTrxDetail.ItemNumber = Item.ItemNumber
WHERE RetailTrxDetail.LoyaltyCustomerID = @LoyId
ORDER BY RetailTrxDetail.TrxDate DESC
```

- **A row is one sales *line* — one item on one receipt**, not one transaction. A five-item basket is
  five rows sharing a `TrxNumber`.
- **Capped at 500**, no paging, no count, no more-rows signal. Same blindness as Activities, at a
  cap a heavy member will actually hit.
- **Order: `TrxDate DESC`.** `TrxDate` is a date (`TrxTime` is a separate column and is **not
  selected**), so all lines of one day tie and their relative order is undefined.
- **`INNER JOIN Item`** — a line whose item no longer exists in `Item` **vanishes from the list**.
- Two fields are computed in C# after the query: `DocType = ((RetailDocumentType)DocumentTypeNumber).ToString()`
  and `TrxType = ((RetailTrxType)TrxTypeNumber).ToString()` — **.NET enum names, in English, as data**.

### Fields

| Field | C# type | Note |
|---|---|---|
| `StoreCode` | `string` | code, no store name |
| `TrxNumber` | `string` | receipt number |
| `TrxDate` | `DateTime` | date only in practice — `TrxTime` is not selected |
| `TrxType` | `string` | enum **name** (`RetailTrxType`), filled server-side |
| `TrxTypeNumber` | `short` | the raw code |
| `DocType` | `string` | enum **name** (`RetailDocumentType`), filled server-side |
| `DocumentTypeNumber` | `short` | the raw code |
| `ItemNumber` | `string` | |
| `ItemDescription` | `string` | joined from `Item.Description` |
| `UnitPrice` | `decimal` | |
| `Qty` | `decimal` | `QuantityValue` |
| `Amount` | `decimal` | `AmountValue` — the **line net value column**, not gross |
| `Currency` | `string` | |

Note the SQL also selects `LoyaltyCustomerID`, which has **no property on `LoyaltySalesLine`** — Dapper
drops it. It does not reach the client.

### What a WPF Sales user loses

`SalesView.xaml` binds a DevExpress `GridControl` straight to `List<RetailTrxDetail>` with **no
declared columns** — DevExpress auto-generates a column per public property, over the *entity*, with
`Item`, `Trx` and `Customer` eagerly fetched. So the WPF grid exposes, in principle, the whole of
`RetailTrxDetail`. Concretely, the web loses:

- **All discount and promotion detail**: `DiscountAmount`, `DiscountPercent`, `TotalDiscount`,
  `TotalDiscountValue`, `MissingDiscountValue`, `PaymentDiscount`, `LineDiscountType`,
  `BBCode`/`BBDiscountType`/`BBDiscountAmount`/`BBDiscountPercent`/`BBSignature`,
  `PromoNo`, `PromotionCouponCode`, `PromotionCouponDiscount`.
- **All tax/gross detail**: `IsTaxable`, `VatAmount`, `VatAmountValue`, `GrossAmount`,
  `GrossAmountValue`, `NetAmountValue`, `Surcharge`, `SurchargeVat`. The web keeps only `Amount`.
- **Receipt/line identity**: `LineNumber`, `BBLineNumber`, `ReceiptNumber`, `MachineCode`,
  `StaffID`, `RetailTrxStatus`, `ReturnFromTrxNumber`.
- **Insurance fields**: `IsDawaaInsurance`, `InsuranceMaxCoverage`, `InsuranceDeductibleAmount`,
  `InsuranceActualDeductibleAmount`, `InsuranceItemCategory`.
- **Flags**: `IsFreeGoods`, `WithPrescription`, `IsPillPack`, `PillPackPouchCount`, `Barcode`,
  `UOM`, `UOMFactor`, `Quantity` (as distinct from `QuantityValue`).
- **Navigation objects**: the whole `Trx` header, `Store`, `POSMachine`, `Customer`, `LoyaltyCustomer`.
- **`TrxTime`** — WPF can order within a day; the web cannot.
- **No cap.** WPF's NHibernate query is unbounded — the full history. The endpoint gives the most
  recent 500 lines.
- **DevExpress's per-column auto-filter row** and cell multi-select — grid affordances, replaceable
  by AG Grid, listed only for completeness.
- **A double-click handler** (`TableView_MouseDoubleClick` in `SalesView.xaml.cs`) that opens the
  transaction. Out of scope: phase 1 has no act.

Set against the map's ruling — the endpoint's shape wins, no new endpoint — the honest summary is:
**the web Sales tab is a line-level purchase history (store · receipt · date · type · item · qty ·
unit price · amount), and every money breakdown below the line total is gone.** That is a real loss
for anyone auditing a discount dispute, and it is the thing to say out loud in the spec.

---

## 4. `GET Loy/Reports/LoyMemberActions` → `LoyMemberActionReportResult`

`[AsParameters] LoyMemberActionParams` — **all five filters are query-string params, and every one of
them is optional**:

| Param | Type | Default | Behaviour |
|---|---|---|---|
| `LoyId` | `string?` | — | equality filter; omitted ⇒ no filter |
| `Mobile` | `string?` | — | equality filter on `LoyMember.Mobile` |
| `MainActionType` | `string?` | — | equality filter (`SNUP`, `MUPD`, `CHMB`, `SNIN`, `MBLK`, `MUBL`, `CHTR`, `SBTP`, `USTP`, `SSUP`, `ACIA`, `RMSB`) |
| `FromDate` | `DateTime?` | — | `ActionDateTime >= @FromDate` |
| `ToDate` | `DateTime?` | — | `ActionDateTime < @ToDate + 1 day` — **inclusive of the whole end day** |
| `Page` | `int` | **1** | coerced to 1 if `<= 0` |
| `PageSize` | `int` | **25** | no upper bound enforced |

- **`loyId` is a param, and nothing is required.** A bare `GET Loy/Reports/LoyMemberActions` returns
  **the first 25 member actions of the entire estate**, newest first, across all members. The portal
  must always send `LoyId` — forgetting it is a silent cross-member data leak, not an error.
- **It is genuinely paged**, and it is the only one of the three tabs that is: `OFFSET/FETCH` on
  `ORDER BY ActionNo DESC`, plus a second `COUNT(*)` query for the totals. `commandTimeout: 120`.
- WPF sidesteps paging entirely: `OmsHttpService.LoyMemberActions` hardcodes
  `?Page=1&PageSize=500&LoyId={loyId}` and shows page one. The web can page properly, or copy the
  one-big-page trick — a decision for the tab ticket.

### The envelope inside the envelope

```
data: {
  records: LoyMemberActionModel[],
  currentPage: int, pageSize: int,
  pageRecordsCount: int,     // rows in this page
  totalPages: int, recordsCount: int   // total across all pages
}
```

**This is the only read that tells the truth about volume** — `recordsCount` is a real total.

### A record

Each row is one entry in `LoyMemberAction`, **denormalised with a snapshot of the member** (the SQL
inner-joins `LoyMember` and left-joins `LoyCity`, `LoyMemberBlockedReason`, and both action-type
tables):

| Field | C# type | Note |
|---|---|---|
| `ActionNo` | `string` | the key and the sort |
| `LoyId` | `string` | |
| `MainActionType` | `string` | code |
| `MainActionDescription` | `string` | **joined English** from `LoyMemberMainActionType` — LEFT JOIN, so null for an unknown code |
| `SubActionType` | `string` | code |
| `SubActionDescription` | `string` | joined English, LEFT JOIN ⇒ nullable |
| `ActionDateTime` | `DateTime` | |
| `ActionData` | `string` | free-form payload — what changed (e.g. old/new value). **Untyped.** |
| `ActionData2` | `string` | second free-form slot |
| `UserId` | `string` | **who did it** — the back-office operator |
| `BranchId` | `string` | code |
| `StaffId` | `string` | |
| `Mobile` | `string` | member snapshot |
| `FullName` | `string` | member snapshot — **PII repeated on every row** |
| `Email` | `string` | member snapshot |
| `Gender` | `string` | code |
| `CityName` | `string` | **the decoded city name** — the one place the API hands over `LoyCity.CityName` rather than a code |
| `ProfileUpdated` | `bool` | |
| `InsuranceCompany` | `string` | |
| `BlockedReason` | `string` | **the *description*, joined** — unlike `LoyMemberModel.BlockedReason`, which is the code. Same name, different content. |
| `JoinedDate` | `DateTime` | `LoyMember.CreatedAt` |

Since every row carries the same member snapshot, **only the first eleven fields are per-row
information**; the rest are the member repeated. A row for this screen is realistically
`ActionDateTime · MainActionDescription · SubActionDescription · ActionData · UserId · BranchId`.

---

## 5. Cross-cutting findings the spec must absorb

1. **Nothing is a 404 and nothing is a null-data miss.** A bad key is `LOY-00100` on the member call
   only; the tabs answer `[]`. The member call is the single gate.
2. **Two of the three tabs are silently capped** (100 activities, 500 sales lines) with **no total and
   no more-rows flag**. The screen cannot honestly say "showing 100 of N" — it can only say "the most
   recent 100". Actions is the exception and carries `recordsCount`.
3. **Codes arrive without decoders**, except three: activity `Description`, action
   `MainActionDescription`/`SubActionDescription`, and action-row `CityName`. `Tier`, `Gender`,
   `Nationality`, `CityCode`, `BlockedReason` (on the member), `ActivityStatus`, `StoreCode`,
   `BranchId` are bare codes. Decoding tier/blocked-reason means a **second endpoint**
   (`Loy/Tiers`, `Loy/MemberBlockedReasons`); decoding gender/nationality/city on the member has **no
   endpoint at all**. This is the fog item "server-supplied codes in English" and it now has an
   answer shape: pass through, or add two lookup calls, or hardcode the three tiers.
4. **`BlockedReason` means two different things** on two payloads — code on `LoyMemberModel`,
   description on `LoyMemberActionModel`. A shared TS type would be wrong.
5. **Three fields on `LoyMemberModel` are inert**: `Profile` (always `"W|D"`),
   `PointsExpireSoonDays` (always `30`), `RedemptionFactor` (always `22.2222222222`). Don't build UI
   on them.
6. **Dates are never null** — they arrive as sentinel dates. `BirthDate`, `EffectiveTime`,
   `ExpiryDate` all need an "is this a real date" guard; the server's own thresholds are
   `< 2000-01-01` for `EffectiveTime` and `Points <= 0` for `ExpiryDate`.
7. **`Loy/Reports/LoyMemberActions` with no `LoyId` returns the whole estate.** The strongest
   correctness constraint in this inventory.
8. **`branchId` is a currency-conversion knob and nothing else** — pass nothing.
9. **No backend change is needed for phase 1.** Every field the screen could want already ships. The
   only "would need a server change" items are (a) a real count/paging for Activities and Sales, and
   (b) decoding gender/nationality/city on the member payload — both avoidable by scoping, neither a
   blocker.

10. **The web door does not change any of this.** `CallCenterWeb/Member/{loyId}` and
    `CallCenterWeb/MemberByMobile/{mobile}`
    (`Services/SIS.Api/Endpoints/CallCenter/CallCenterWebEndpoints.cs:226-236`) are one-line
    delegations to `LoyEndpoints.GetLoyMember` / `GetLoyMemberByMobile` — same payload, same 45 s
    cache, same error codes, same archived divergence. Everything above holds whichever door
    ticket 228 picks.

### Noticed on the way, not in scope

- WPF's Account view also shows an **Activity Summary** grid (year · month · last visit date · last
  visit store · net sales · redeem amount · visits count) sourced from loyalty activity statistics —
  a **fifth read** the map has not named. It is arguably the most useful thing on WPF's account
  screen. Flagged for the map, not claimed.
- WPF's Account view shows **"Old Account (Mobile)"**, read from the legacy `LoyaltyCustomer` table by
  `LoyaltyID`. There is **no endpoint** for it. Dropping it is the natural phase-1 call.
- `Loy/Reports/LastPurchases` (already out of scope) is `LastActivities` narrowed to
  `ACRL`/`ADJC`/`RDCN`/`RDEM` with points computed as
  `FLOOR(PointsAmount × SpendPointsFactor × ±1)` by debit/credit indicator — i.e. **a signed points
  column that `LastActivities` does not have.** If the Activities tab wants "+120 / −80" rather than
  a bare magnitude, that sign has to be derived client-side from `ActivityType`, because
  `LastActivities` does not select `DebitCreditIndicator`.
