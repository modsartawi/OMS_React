# 793 — The v2 areas' sources on the replica

Ticket [800](../../.issues/800-which-tables-do-the-new-areas-need-and-are-they-on-the-replica.md),
2026-11-06. Checked against the production read replica `172.23.27.47` / `POS` (`DWPOSREPL03`)
through the sanctioned read-only `sqlcmd` door, and against BackOffice and Nphies-service source
(read-only). Aggregates only. "Yesterday" is Thu 2026-11-05.

Probes and their raw output, beside this file:
- [800-replica-probe-a.sql](800-replica-probe-a.sql) → [out](800-replica-probe-a.out.txt) — catalog: presence, rows, indexes, publications, columns.
- [800-replica-probe-b.sql](800-replica-probe-b.sql) → [out](800-replica-probe-b.out.txt) — timed one-day aggregates. Run section by section, because the one-file run lost its connection.
- [800-replica-probe-c.sql](800-replica-probe-c.sql) → [out](800-replica-probe-c.out.txt) — follow-ups on the keys.

The areas and measures are the ones in [793-v2-semantic-model.md](793-v2-semantic-model.md).

## 1. The answer in one table

| Area | On the replica | Missing | Daily aggregate | Verdict |
|---|---|---|---|---|
| **0 Orders: cancellation, delivery type** | `DeliveryHeader` (7.1 M, NCCI), `SdDocument*` (`OMS` publication) | — | seconds | **Ready.** The till's join to an order is `SdDocumentHeader.OrderNo`, not `DocumentNo` (§2). |
| **1 Coupons and promotions** | `RetailTrxCondition` (1.8 B, NCCI), `RetailTrxDetailPromo` (726 M), `Bonusbuy`, `BBHeader`, `Promotion*` (`Master1`), `SdDocumentLine.PromotionCoupon*` | **every Coupons V2 table**, `PaymentDiscountCampaign`/`Swipe` | 7–8 s through `RetailTrx` | **Half ready.** The till-side discount and bonus-buy figures can be built now. Redemption counts, reversals, the coupon campaign and payment discounts wait on a DBA task (§3). |
| **2 Loyalty** | every table it needs (`Loy` publication) except `LoyCampaign` | `LoyCampaign`, which does not exist on the replica | **56 s full scan** (no date index), cheap by id range | **Ready.** The incremental reads `ActivityId > last max` (§4). |
| **3 Insurance claims** | **`NAuth` / `NAuthLine`**, the Nphies service's own table for claims *and* prior authorisations (`Nphies` publication, fresh to the hour), `NPayer` | `NphiesTrxClaimHeader`/`Line`, the WPF claim path that v2 does not need; `SdDocumentInsurance` | 5–25 s | **Ready, on a different table** from the one 796 named. Claims key to the till at 98 % (§5). |

**One DBA task results:** [The DBA adds the Coupons V2 and payment-discount tables to the replica publication](../../.issues/818-the-dba-adds-the-coupons-v2-and-payment-discount-tables-to-the-replica-publication.md).
It is the 753 analogue. Claims need no DBA task.

## 2. Orders (rank 0) and the till → order key that 799 owed

- `DeliveryHeader` arrives in the `OMS` publication: 7,111,725 rows, a clustered PK plus an NCCI.
  804's QC and cancellation facts were measured on it.
- **The till → order key.** `mart_till_sales_daily.order_no` reads `RetailTrx.OrderNo`.
  Yesterday 12,485 of 187,606 sales carried one, across 12,457 distinct values. Matched against:

  | Candidate | Matches |
  |---|---|
  | `SdDocumentHeader.DocumentNo` | **36** |
  | `SdDocumentHeader.OrderNo` (headers of the last 30 days) | **12,423 (99.7 %)** |
  | `SdDocumentHeader.RefDocumentNo` | 0 |
  | `DeliveryHeader.DeliveryNo` | 0 |

  So till's `delivery_type` (799) is reached through
  `RetailTrx.OrderNo = SdDocumentHeader.OrderNo → DocumentNo = DeliveryHeader.RefDocumentNo`. It
  is **not** reached through `order_no = DocumentNo`, which would leave almost every sale `(none)`.
  - The probe took 8 s for one day.
  - `OrderNo` is not unique per header: an order and its category-`X` follow-on documents can share
    it. The build picks the order header (`DocumentCategory = 'O'`) and checks for fan-out.
  - `fct_delivery` already uses `d.RefDocumentNo as order_no`. That is a document number, and it is
    fine for orders. It is the till side that must join through `OrderNo`.

## 3. Coupons and promotions (rank 1)

### What is there

| Table | Rows | Index | Publication | Facts |
|---|---|---|---|---|
| `RetailTrxCondition` | 1,803,059,046 | PK + NCCI | `RetailTrxConditions` | **`Year` and `Month` are 0 on every row.** Date it through `RetailTrx` on the PK (`Client, StoreCode, MachineCode, TrxNumber`). |
| `RetailTrxDetailPromo` | 726,188,483 | PK only (rowstore) | `RetailTrxDetailPromo` | PK seek from `RetailTrx`: 7 s a day |
| `Bonusbuy` | 19,415 | PK `(Client, Code)` | `Master1` | **the bonus-buy dimension**. It has description, type, dates and `PromoNo` |
| `BBHeader` | 32,826 | heap | `Master1` | description and dates, but misses some codes |
| `Promotion`, `PromotionItem`, `PromotionStore` | small | PK | `Master1` | promotion number → description |
| `SdDocumentLine.PromotionCouponCode` / `PromotionCouponDiscount` | — | — | `OMS` | coupons on **orders**: 5,788 lines, 78,007 SAR in 30 days, nearly all on category-`O` orders |

Yesterday, through `RetailTrx` (7.7 s):

| Kind (`RetailTrxCondition`) | Rows | Discount (SAR) | Distinct codes |
|---|---|---|---|
| bonus buy (`BbyNumber` set) | 62,435 | 1,171,608 | 194 bonus buys |
| coupon (`CouponCode` set) | 2,970 | 96,723 | 20 coupon codes |
| other (pricing conditions) | 677,888 | — | — |

- `RetailTrxDetailPromo` the same day: 399,258 lines, `TotalBBDiscount` −1,268,331. It is the same
  order as the conditions' bonus-buy discount, but not equal. The parity check names the gap.
- **Bonus-buy key:** 214 of 214 distinct `BbyNumber`s match `Bonusbuy.Code`; only 198 match
  `BBHeader.BBCode`. The campaign dimension reads `Bonusbuy`.
- **The catalogue's names were wrong.** `BbyHeader` and `RetailTrxBonusbuy` are not BackOffice
  tables at all. Their role is played by `Bonusbuy`/`BBHeader` and by `RetailTrxCondition` +
  `RetailTrxDetailPromo`.
- `RetailTrxCondition.CouponCode` holds 20 distinct values for 2,970 rows. It looks like a
  template- or campaign-level code, not a per-customer code. The build confirms this against
  `CouponInstance` once that table lands.

### What is missing, and where it lives

Not on the replica under any name, and in no publication:
- `CouponTransaction`, `CouponInstance`, `CouponTemplate`, and the rest of Coupons V2
  (`CouponImportJob*`, `CouponReversalQueue`, `CouponAdminAudit`);
- `PaymentDiscountCampaign`, `PaymentDiscountCampaignBin`, `PaymentDiscountSwipe`;
- `PosTransactionCoupon`.

All of them are mapped in `Sartawi.Retail.Data` and run on SIS.Api's `DefaultConnection`
(`172.23.27.50` / `POS`; "the coupon DB (DefaultConnection)" in `CouponReversalRunner.cs`). That is
the central POS database, so they sit on the publisher and need **article adds**, not a new
subscription. The DBA confirms that `172.23.27.50` is `DWPOS03`.

### What this means for the measures

| Measure (793-v2-semantic-model §3) | Now | After the DBA task |
|---|---|---|
| `coupon_discount_value_sar` | **yes**: `RetailTrxCondition` coupon rows; orders through `SdDocumentLine` | same |
| `bonus_buy_applications`, `bonus_buy_discount_value_sar` | **yes**: conditions + `RetailTrxDetailPromo` | same |
| `promoted_sales_share` | **yes** | same |
| `coupon_redemptions` (net of reversals) | proxy only: till transactions with a coupon condition | **yes**: `CouponTransaction` with `IsSuccessful` and `RefTransactionId` |
| Campaign dimension for coupons | no | `CouponTemplate.CampaignId` |
| `RedemptionType` | no | `CouponTransaction.RedemptionType` |
| Payment-discount kind and value | no | `PaymentDiscountSwipe` → `PaymentDiscountCampaign` |
| `discount_per_redemption_sar` | no | yes |

**Personal data:** `PaymentDiscountSwipe` holds `Bin` and `Last` (card digits). They are
column-filtered out of the article. `CouponInstance.CustomerId` is the coupon holder: it is filtered
too, or at the least never declared.

## 4. Loyalty (rank 2)

### Presence

Everything is in the `Loy` publication. `Loy_2` carries `LoyActivityImport` and
`LoyCampaignAction`, `Loy_Family` the `LoyFamily*` tables, and `Other1` `LoyTierDowngradeTracker`.

| Table | Rows | Index |
|---|---|---|
| `LoyActivity` | 341,774,583 | PK `ActivityId` only. **No date index, no NCCI.** |
| `LoyActivityLine` | 163,302,512 | PK `(ActivityId, MaterialNumber)` |
| `LoyMembership` | 12,286,439 | PK `LoyId` |
| `LoyMember` | 14,874,400 | PK `LoyId` |
| `LoyTier` | 3 (S Silver, G Gold, P Platinum) | |
| `LoyActivityType` | 49 | |
| `LoyLedger` | 460,727,952 | PK `LedgerId` |
| `LoyActivityStatisticsDay` | 244,886,846 | PK `(PeriodDay, LoyId)`: a member-day pre-aggregate with no branch |
| `LoyActivityTypeStatisticsDay` | 319,590,087 | PK `(PeriodDay, LoyId, ActivityType)` |

**`LoyCampaign` does not exist on the replica.** The campaign is `LoyActivity.CampaignId`
(varchar 60). It is filled on 4,202 of yesterday's 11,863 promotion activities. The loyalty
campaign dimension is that id with no description, unless BackOffice names the source of the
description.

### Cost

- One day of `LoyActivity` filtered on `ActivityDateTime` is a **full scan: 55.7 s**.
- `ActivityId` is numeric and ascending (yesterday 21014709313 → 21015180853). The incremental
  therefore reads `ActivityId > {last max}`, a PK range seek, and re-reads a **10-day id window**
  for late cancellations, the same window as 796's orders. A one-off backfill is a full scan and
  runs off-hours.
- `LoyMembership` snapshot by tier: 0.2 s. `LoyMember` enrolments for a day: 0.3 s.

### Yesterday's shape (`ActivityTypeGroup`)

| Group | Meaning (`LoyActivityType`) | Activities | Branches |
|---|---|---|---|
| E | expiry (`EXPS`, `EXPT`) | 184,298 | **1** (a system branch, not a store) |
| S | sales accrual (`ACRL`, `RLBE`) | 86,868 | 956 |
| P | promotion points (`PR*`, `WLC*`, `RLBN`) | 11,863 | 825 |
| R | redemption (`RDBB` branch, `RDEM` e-commerce, `RDBC` call centre, `RLRD`, `RLPD`) | 3,152 | 754 |
| C | accrual cancel (`ALCN`, `RLCN`) | 1,405 | 640 |
| M | redemption cancel (`RDCN`, `RLRC`) | 253 | 36 |
| 3 | third-party (Ehsan, Kanaf, Fursan, Qitaf) | 40 | 1 |
| T | transfer | 4 | 1 |

- **Store join:** excluding expiry, 93,576 of 103,585 activities (90 %) have a `BranchId` that is a
  `Store.StoreCode`. The rest are e-commerce or call-centre branches, shown as their own members.
  Expiry has no store: `points_expired` is programme-level, under store `(programme)`.
- `IsCancellation` is set exactly on groups C and M. Netting reads `ActivityTypeGroup`, not a flag.
- Enrolments yesterday: 3,881 (`MemberType = 'M'` only), at 754 branches.
- Snapshot: Silver 12.05 M members, Gold 195 k, Platinum 40 k. Outstanding points: 856.8 M.

### The loyalty-redemption key on the till (the reconcile)

- The redemption payment is **`RetailTrxPayment.PayTypeID = 'Points'`**: 2,967 payments,
  59,458 SAR yesterday. 2,963 of them carry a `RequestId`.
- `LoyActivity.RequestId = RetailTrxPayment.RequestId` matches **2,135 of 2,137** branch
  redemptions (`RDBB`). `LoyActivity.ReferenceNumber` also equals the till's `TrxNumber` at
  `BranchId` (2,136 of 2,137).
- `RDEM` (e-commerce, 1,015 a day) matches 650 by `RequestId` and carries
  **`PointsAmountInCurrency = 0`**. So `redemption_value_sar` from `LoyActivity` alone undercounts
  e-commerce. The build values `RDEM` from the matched payment, or from `SpendPoints` × the
  programme rate. That choice is for the spec.
- `STCPoints`, `MokafaaAlRajhi`, `MobilyNeqaty` and `Akthr` are partner-points tenders, not this
  programme. They never enter the reconcile.
- The cost is about 2 min for one day, because it is the full `LoyActivity` scan again. With the
  id-range incremental it costs seconds.

**Personal data:** `LoyMember` replicates `Mobile`, `FullName`, `NationalId`, `Email`, `BirthDate`,
`Gender` and `Nationality`. dbt selects only `CreatedAt`, `CreatedByBranchId` and `MemberType`, by
column list and never `*`, and a schema test fails if a staging model names any other column.

## 5. Insurance claims (rank 3)

### The claim table is `NAuth`, not `NphiesTrxClaimHeader`

- `NphiesTrxClaimHeader` / `Line` are **not on the replica** and in no publication. They are the
  older WPF claim-submission path (`Sartawi.Retail/Nphies/ClaimSubmission`, read through the
  default `DataAccess` session).
- The live Nphies service (`C:\Work\DMSCO\nphies\Service\NphiesService`) records every exchange in
  **`NAuth`** (+ `NAuthLine`). Its `ClaimTypeEnum` is: `0` PriorAuth, **`1` Claim**, `2`
  AdvancedPriorAuth, `3` DirectDispense, **`4` DirectClaim**, `6` BupaSabic. 3, 4 and 6 are
  "approved in-house, nothing is sent to the payer".
- `NAuth` (11,137,055 rows) and `NAuthLine` (121,600,926) arrive in the `Nphies` publication from
  `NPDB01`. Newest row: 2026-11-06 04:00, the same hour.
- **No DBA task is needed for claims**, and the claims area does not shrink.

### Volume and shape (30 days to yesterday)

- 150,265 claims (`ClaimType` 1 or 4), 30 payers, 951 providers.
- Claims are submitted in **batches about three weeks after the service**: yesterday's batch had
  `ServiceDate` from 2026-10-01 to 11-05, mostly mid-October. The claim's date is a decision for the
  spec: `ServiceDate` (when dispensed) or `ActionDateTime` (when submitted). A service-dated count
  keeps rising for about a month.
- On a claim the header money fields (`Submitted`, `Benefit`, `PatientShare`) are **0**, and
  `AdjudicationOutcome` is `pended` or NULL on the day it is sent. The submitted value is on the
  lines: yesterday 3,451 claims, 10,509 lines, `NAuthLine.NetAmount` 2,435,552 SAR. The outcome
  arrives later as an update to the same row (`UpdateDateTime`). The incremental re-reads claims
  whose `UpdateDateTime` moved, not only new ones.
- Prior authorisations (`ClaimType` 0 and 2) *do* carry adjudication as columns: `approved`,
  `rejected`, `partial`, `not-required`, with `Benefit` and `Submitted` on the header and the lines.
  Yesterday's prior-auth lines were 9,235 approved (1.92 M SAR) and 3,185 rejected (1.42 M SAR).
  **This corrects 796:** approved amounts are not only inside `InsuranceAuthFhir.BundleJson`. For
  prior authorisations they are plain columns. Whether v2 uses them is scope, not sourcing (§7).

### Keys

| Key | Result |
|---|---|
| **Store:** `NAuth.ProviderCode = Store.StoreCode` | **951 of 951** providers, exact (codes like `P239` and `1184` are both store codes) |
| **Claim → till:** `(ProviderCode, InvoiceNo) = RetailTrx (StoreCode, TrxNumber)`, within the service-date window | **3,412 of 3,482 (98 %)** yesterday, hash join, 7.8 s. This gives a claim the sales-channel family. |
| Claim → order: `NAuth.RefDocumentNo` | filled only on some prior authorisations (89 of 2,323 approved); not a claim key |
| Payer: `NAuth.PayerCode` → `NPayer` (57 rows) | present. The till header's `RetailTrx.NphiesPayerCode` is filled on 4,341 of 189,620 sales, all in `NPayer` |

`NProvider` (provider credentials and certificates) is **not** replicated and must never be. The
store mapping above makes it unnecessary.

### Order-line approval (`SdDocumentLine.ApprovalStatus`)

- The lookup `SdDocumentApprovalStatus` has A Approved, C Cancelled, D Dispensed, E ApprovalError,
  P PartiallyApproved, Q ApprovalRequested, R Rejected.
- **In production, over 30 days, only blank and `A` occur**: 14,064 `A` lines, all on
  category-`X` documents. `Q`, `P`, `R` and `E` never appear. So `order_line_approval_rate` is 100 %
  by construction and says nothing. **Drop it from v2.** The approval measure that carries
  information is the prior-authorisation outcome on `NAuth`.
- Order payer: `SdDocumentHeader.PayerCode` is filled on 3,025 category-`O` orders and 45,730
  category-`X` documents in 30 days. `SdDocumentInsurance` (BO 3389) is not replicated. The header
  column is enough for a payer dimension on orders, so it is not added to the DBA task.

**Personal data:** `NAuth` replicates `PatientName`, `PatientId`, `PatientBirthDate`, `MemberId`,
`PolicyNumber`, `PolicyHolder`, `Diagnosis`, `Occupation`, `MaritalStatus` and the raw
`CommRequest`/`CommResponse`. The staging model selects by column list only: ids, codes, dates,
amounts and outcomes. The same schema test that guards `LoyMember` applies.

### A trap: `NPaymentNotice` and `NPaymentReconciliation`

Both exist on the replica (588,800 and 743,602 rows). Their newest rows are dated **2026-02-10/11**,
and they are in no publication: they are a stale leftover of an old subscription. They must **never**
be read as "paid" figures. A paid-amount area would need them re-published first. That is fog, not
part of v2 (796).

## 6. Cost summary for 750's caps

These are dbt-side reads on the replica (marts are built nightly). Cube reads only the marts.

| Read | One day |
|---|---|
| `RetailTrx` → `RetailTrxCondition` (PK seek) | 7.7 s |
| `RetailTrx` → `RetailTrxDetailPromo` (PK seek) | 6.9 s |
| `LoyActivity` by date (full scan) | 55.7 s. Use the id range instead. |
| `LoyMembership` / `LoyMember` | under 0.3 s |
| `NAuth` 30 days by type and outcome | 21.9 s |
| `NAuth` → `NAuthLine` one day | 4.6 s |
| claim → till match, one day | 7.8 s |
| till → order (`OrderNo`) one day | 8.1 s |
| `SdDocumentHeader` → `SdDocumentLine` 30 days | 13.3 s |

Nothing here needs a Cube pre-aggregation. The marts are small (day × store × a few dimensions).

## 7. What changes in the catalogue (793-v2-semantic-model.md)

For the spec to carry. The catalogue itself is not rewritten:
1. **Claims read `NAuth`/`NAuthLine`** (`ClaimType` 1 and 4), not `NphiesTrxClaimHeader`.
   - `submitted_claim_value_sar` = Σ `NAuthLine.NetAmount`.
   - `claims_submitted` is every claim row: a row exists only because it was sent. `ClaimSubmitted`
     was 0 on every row yesterday, claims included, so it is not the submission flag, and
     `claim_submission_rate` is dropped.
   - The claim outcome is `AdjudicationOutcome`, which arrives late.
2. **`order_line_approval_rate` is dropped.** Production writes only `A`.
3. **Optional, the owner's call:** a prior-authorisation measure set from `NAuth` (`ClaimType` 0
   and 2). It holds approval rate, approved `Benefit` and rejected counts, all as columns. This
   reopens 796's "submitted only" ruling with a fact 796 did not have.
4. **Bonus-buy campaign** = `Bonusbuy`. `BbyHeader` and `RetailTrxBonusbuy` are dropped as names.
5. **Loyalty campaign** = `LoyActivity.CampaignId`. There is no `LoyCampaign` table.
6. **`RDEM` redemption value** needs a rule, because its `PointsAmountInCurrency` is 0.
7. **The till's `order_no` joins `SdDocumentHeader.OrderNo`.** This answers 799's owed fact.
