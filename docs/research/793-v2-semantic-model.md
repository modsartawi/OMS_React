# 793 — The v2 semantic model: new subject areas, measures, dimensions, questions

Settled in ticket [796](../../.issues/796-which-new-subject-areas-does-v2-add-and-which-hq-questions-do-they-answer.md)
(grilling with the owner, 2026-11-06). The facts below come from the BackOffice source
(`C:\Work\DMSCO\BackOffice`, read-only) and from the replica probe of 2026-11-03
([741-replica-probe.out.txt](741-replica-probe.out.txt)). Table presence, row counts and costs on the
replica are the job of [800](../../.issues/800-which-tables-do-the-new-areas-need-and-are-they-on-the-replica.md).
Aggregates only.

## 0. The baseline is the shipped model, not the v1 catalogue

[741-v1-semantic-model.md](741-v1-semantic-model.md) describes spec 766's four areas. BackOffice
then shipped **oms-analytics 1.2.0** (BO 3387 + 3388, `Analytics/`), which went further. Its Cube
views today are:

| View | Area | Since |
|---|---|---|
| `till` | Till sales, with sales channel, order source, order type, sales document type, sale type, programme, refund channel | 1.0, widened 1.2.0 |
| `channel_orders` | Orders by channel group | 1.0 |
| `delivery` | Delivery speed | 1.0 |
| `callouts` | Callouts and donor requests | 1.0 |
| `item_sales` | Units, value, discount, VAT and returns per item, with the A–E hierarchy, brand, vendor, manufacturer and ABC class (since 2026-01-01) | **1.2.0** |
| `slow_moving` | Stock on hand, dead stock and days of cover per item and store, as of yesterday | **1.2.0** |
| `customers` | Visits, average basket, distinct customers, new against regular. The customer is a salted hash that is never a member | **1.2.0** |

So the 745 candidate **"products and materials" is already shipped** and is not a v2 area.
Over-the-counter against prescription is the one gap there: `ItemInfo.OtcList` is unverified as
that flag. It is a dimension to add to `items` if it checks out, not a new area.

The shared sales-channel dimensions are defined once in the private `sale_channel` cube, and every
till-grain cube extends it. v2's till-grain areas extend it too.

## 1. What v2 adds, ranked

| Rank | Area | Kind | Main source (BackOffice path) | State |
|---|---|---|---|---|
| 0 | **Orders: cancellation and delivery type** | widens `channel_orders` and `delivery` | `SdDocumentHeader`, `SdDocumentHeaderStatus`, `SdDocumentLog`, `DeliveryHeader` | on the replica (804); platform-side cancels are not |
| 1 | **Coupons and promotions** | new area | `CouponTransaction` → `CouponInstance` → `CouponTemplate` (`Modules/Coupons/V2/Data/Maps`); `RetailTrxCondition`, `RetailTrxDetailPromo`, `RetailTrxBonusbuy`; `BbyHeader` | `RetailTrxConditions` and `RetailTrxDetailPromo` publications present; `CouponTransaction` owed by 800 |
| 2 | **Loyalty programme** (aggregates) | new area | `LoyActivity` (+ `LoyActivityLine`), `LoyMembership`, `LoyTier`, `LoyMember` (enrolment date and branch only), `LoyCampaign` (`Modules/Loy/Data/**`) | `Loy`, `Loy_2` and `Loy_Family` publications present; which tables each one carries is owed by 800 |
| 3 | **Insurance claims** (submitted, not adjudicated) | new area | `NphiesTrxClaimHeader` / `Line` (`Sartawi.Retail.Data/Nphies`); `SdDocumentLine.ApprovalStatus`, `SdDocumentInsurance` | **to verify by 800**: v1 found no claim outcome on the replica, but the `Nphies` and `Others` publications from `NPDB01` merge into replica `POS` |

Rank 0 is not optional. The owner's acceptance case (map 793 Notes) needs it.

**Ruled out (owner, 2026-11-06):**
- **Revenue, margin and cost.** POS has no cost at the time of sale: no moving-average price and no
  `VPRS` condition. Only today's `ItemInfo.UnitCost` and `Item.CurrentCost` exist, so a margin is an
  estimate at today's cost. Wording stays "value through our tills". Margin comes back only when
  there is a cost-at-sale source, as its own effort.
- **SAP / IDoc export health.** This is an operations concern, and the SAP export console (spec
  2579) and the sync console already cover it. The mirror-lane tables sit on `POS_Server` and are
  not on the replica anyway.

## 2. Shared dimensions

Everything in [741 §2](741-v1-semantic-model.md) stands: the date capped at today, weeks starting
Sunday, store, city, region and country. v2 adds:

| Dimension | Definition | Used by |
|---|---|---|
| **Sales channel family** (`sale_channel`) | the six channels plus source, order type, sales document type, sale type and programme, as shipped | coupons and promotions; insurance claims, through the claim's till transaction where it links (800 confirms the key) |
| **Delivery type** (new) | the delivery document's `DeliveryDocumentType`: `QC` quick commerce, `DL`, `BB`, `LF`, `DLR` (`DeliveryDocumentTypeConstants.cs`). An order with no delivery is `(none)` | orders, delivery |
| **Item** (`items`, shipped) | the hierarchy, brand, vendor, ABC | coupons and promotions at line grain |
| **Campaign** (new) | for a coupon, `CouponTemplate.CampaignId` with its description; for a bonus buy, `BbyHeader` number and description; for a payment discount, `PaymentDiscountCampaign` | coupons and promotions |
| **Promotion kind** (new) | coupon · bonus buy · payment discount · loyalty points | coupons and promotions |
| **Tier**, **activity type**, **member type** (new) | from `LoyTier`, `LoyActivity.ActivityType`, `LoyMember.MemberType` | loyalty |
| **Payer** (new) | `PayerCode` → payer name. A payer is a company, not a person | insurance claims, order insurance |
| **Claim outcome**, **line approval status** (new) | `NphiesTrxClaimHeader.Outcome` / `AdjudicationOutcome`; `SdDocumentLine.ApprovalStatus` A/P/R/C/Q/E/D (`DocumentApprovalStatusConstants.cs`) | insurance claims |

### Delivery type is QC's home, not a channel group

QC is **not** a `DocumentSource` value or an order type (`CMRC`, `CLCN`, `HNGR`, `WSRF`, `NPHS`,
`SSML`), so it cannot become a channel group. It is the delivery's document type. The dispatch
scorecard already filters "Delivery type" (`type=QC`) apart from "Channel" (`channel=…`), and the
model follows it. Delivery type is therefore a **separate dimension that crosses the channel
groups**, neither a sixth group nor a level below them. A HungerStation order may itself be QC.

The owner's example, "two order types, HungerStation and QC", is two **filtered series**:
`channel_group = hungerstation`, and `delivery_type = QC`. How one report shows them side by side is
[799](../../.issues/799-does-comparing-across-sources-need-cross-area-measures-in-one-view-or-panels-side-by-side.md)'s
question. The labels must never call QC a channel.

Facts from [804](804-qc-and-cancellation.md):
- QC is **Dawaa Now**, the express delivery that OTO carries. In the week of 10-25, all 3,952 QC
  deliveries came from `IOS`, `WEB` and `ROID`, which puts them wholly inside `own_app_web`.
- No HungerStation order produced a QC delivery, so the acceptance case's two series do not
  overlap.

The rules that follow:
- **The join:** `DeliveryHeader.RefDocumentNo = SdDocumentHeader.DocumentNo`, reading
  `DeliveryDocumentType`.
- **An order with no delivery** (about 1.6 % in that week) is typed `(none)`.
- **An order with several deliveries** (about 0.5 %) is `QC` if any of them is QC. Otherwise it
  takes its first delivery's type.
- **Labels** come from the semantic model's own value list, **never from the replica's
  `DeliveryDocumentType` lookup**. That lookup has no QC row, and an inner join would drop QC.

`fct_delivery`'s existing `delivery_type` column (`DeliveryHeader.DeliveryType`) is a different
field. The new dimension reads `DeliveryDocumentType`.

*(2026-11-06, owner:)*
- The pick-up/home field is now its own dimension, `fulfilment`.
- Till reaches its delivery by `RetailTrx.DeliveryNo`.
- Slot keeping reads `DeliveryScheduleFromTime` / `ToTime`, `OutForDeliveryTime`,
  `ActualDeliveryTime` and `SdDocumentHeaderAction.ReadyTime`.

See spec 819 §B.

## 3. Measures

### Rank 0 — orders: cancellation (widens `orders_daily` / `channel_orders`)

No status says "cancelled". A cancellation is a **close** ([804](804-qc-and-cancellation.md)).
Once an order has a delivery, the close is recorded **on the delivery**, and the order header
stays at `CloseStatus = ''`. There are no reason codes. Who asked is known only from the
`EntryUser` of the request-close log row (`ORCL`/`DRCL`). The close itself is always written by
`AutoClose`.

**A closed order** is either of:
- the order's own `CloseStatus = 'C'` (this happens only on orders with no delivery);
- any forward delivery of the order at `CloseStatus IN ('C', 'X')`.

`N` (closed, not invoiced) is **left out**: every `N` that week had been delivered. `F` is never
written.

A closed order is then one of two kinds, decided by who requested the close:
- **cancelled:** the requester is a person or the app, the store till (`PH`), the courier
  (`Outbox`) or the platform (`BJ_SYSTEM`);
- **expired:** the requester is `AutoClose`, and nobody acted.

| Measure | Definition | Shape |
|---|---|---|
| `cancelled_orders` | closed orders requested by anyone except `AutoClose` | additive |
| `expired_orders` | closed orders requested by `AutoClose` | additive |
| `cancellation_rate` | Σ `cancelled_orders` ÷ Σ `orders`. **This** is "the cancellation rate" | rate (never averaged) |
| `expiry_rate` | Σ `expired_orders` ÷ Σ `orders` | rate |

- **Dimension `cancelled_by`:** customer or operator · store · courier · platform · expiry, read
  from the request's `EntryUser` bucket. Expiry is never in `cancellation_rate`.
- **The date is the order's `EntryTime`** (the cohort), capped at today. The numerator stays inside
  the denominator's orders. The denominator is all orders, the same `orders` measure as v1, so
  periods add up.
- **Late closes:**
  - Person, store and courier cancels are mostly complete on the same day: 75 %, 64 % and 98 %.
  - Expiries land on **day 8**. The incremental slice therefore re-reads the last **10 days**.
  - The screen and the AI mark days younger than 8 as "expiries may still rise". Because expiry
    is apart, the headline cancellation rate is stable after about a day.
- **Matching the store statistics:** ADR 0081's `ClosedOrCancelled` counts *deliveries* by the day
  of their first close and includes `N`. This area counts *orders* by order date and leaves `N`
  out. The two do not match by design. A parity check runs at delivery grain over the same events
  minus `DCNI`, and the definitions say why the totals differ.
- **Platform cancels are not on the replica (owner, 2026-11-06).** HungerStation's platform-side
  cancel (`DhOrderHeader.Status = 'CANCELLED'`) and Deliverect's (`DlvOrderHeader`) are not
  counted. v2 counts **cancellations inside OMS only**:
  - The measure's description says so.
  - The HungerStation and Deliverect labels carry the caveat wherever the channel group is a
    dimension or a filter. In the week of 10-25, HungerStation's figure was about 0.1 %.
  - The AI repeats the caveat whenever it answers a platform channel's cancellation question.
  - No DBA task is filed for those tables. Bringing them in is a later effort.
- `delivery_type` is added to `orders_daily` and to `fct_delivery` / `mart_delivery_daily`, and
  exposed in both views. `document_type` (the order's type) is already in `orders_daily` but not in
  the view, so the view exposes it as "Order type", with the labels `sale_channel` uses.
- **The channel map has a gap.** Call-centre sources `COBE`, `COBC`, `CFLO`, `COBM` and `CINS`,
  plus `INTG` and `RGSW`, are missing from `channel_map.csv`, so v1 counts them as `other`. That is
  about 7.4 k orders a week. It is fixed in the same change, and the nightly
  `channel_map_covers_recent_sources` test is checked for why it did not name them.

### Rank 1 — coupons and promotions

Two grains, both dated by the till transaction's date:
- the **redemption**: a `CouponTransaction` with `IsSuccessful`, net of reversals through
  `RefTransactionId`;
- the **till line condition**: `RetailTrxCondition`, plus `RetailTrxDetailPromo` /
  `RetailTrxBonusbuy`, joined to the header for date, store and channel.

| Measure | Definition |
|---|---|
| `coupon_redemptions` | successful redemptions minus reversed ones |
| `coupon_discount_value_sar` | Σ coupon discount on the lines (`PromotionCouponDiscount` / coupon `DiscountAmount`) × rate |
| `bonus_buy_applications` | Σ `AppliedTimes` |
| `bonus_buy_discount_value_sar` | Σ `BonusbuyDiscount` (or `TotalBBDiscount`) × rate |
| `promotion_discount_value_sar` | all promotion discounts together (coupon + bonus buy + payment discount) |
| `promoted_sales_share` | till sales with any promotion line ÷ till sales (a rate; the denominator is the till area's `till_sales`) |
| `discount_per_redemption_sar` | `coupon_discount_value_sar` ÷ `coupon_redemptions` (a rate) |

Dimensions: date, store, city, region, country, the sales channel family, campaign, promotion
kind, item (line grain only), and `RedemptionType`. The parity check: `promotion_discount_value_sar`
must reconcile with `item_sales.discount_value_sar` over the same window, or the difference is
named and explained (non-promotion discounts).

The coupon *issue* side (`CouponImportJob` codes added and skipped, `CouponInstance` issued) is an
admin figure and is **not** in v2. "Issued against redeemed" is a fog item if HQ asks for it.

### Rank 2 — loyalty programme (aggregates)

Grain: `LoyActivity` rolled up to day × branch (store) × activity type × tier × campaign. `LoyId`
never leaves dbt. Where a distinct member count is needed, it is the same salted one-way hash
`customer_daily` uses, counted and never declared.

| Measure | Definition | Shape |
|---|---|---|
| `points_accrued` | Σ accrued spend points, cancellations netted (`IsCancellation`) | additive |
| `points_redeemed` | Σ redeemed points, net of redemption cancellations | additive |
| `points_expired` | Σ expired | additive |
| `redemption_value_sar` | Σ `PointsAmountInCurrency` on redemptions | additive |
| `redemptions` | count of redemption activities, net | additive |
| `loyalty_sales_value_sar` | Σ `SalesAmount` on accrual activities. Not revenue | additive |
| `enrolments` | `LoyMember` rows by `CreatedAt`, at `CreatedByBranchId` | additive |
| `active_members` | distinct hashed members with any activity in the selection | rate (never summed) |
| `outstanding_points` | Σ `LoyMembership.PointsBalance`, as of yesterday (a snapshot like `slow_moving`) | snapshot, never summed over days |
| `members_by_tier` | members per `TierId`, as of yesterday | snapshot |

Dimensions: date, store, city, region, country, tier, activity type, member type, loyalty
campaign, and joined year (as `customers` has it).

The redemption value must reconcile with the till's loyalty-redemption payment over the same window
(800 names the payment key). `customers` already answers "how many members bought". This area
answers "what the programme gave out and took back".

**Loyalty groups** (`LoyGroup`, whose `LoyGroupMember` holds `Mobile`) are not in v2. Nobody asked,
and a group's membership list is close to PII.

### Rank 3 — insurance claims (submitted, not adjudicated)

Grain: one `NphiesTrxClaimHeader`, dated by `TrxDate`, plus the order-line approval status from
`SdDocumentLine`.

| Measure | Definition | Label rule |
|---|---|---|
| `claims` | count of claim headers | |
| `claims_submitted` | `ClaimSubmitted` set | |
| `claim_submission_rate` | `claims_submitted` ÷ `claims` | rate |
| `submitted_claim_value_sar` | Σ `NetAmount` | always "submitted", **never** "approved", "paid" or "insurance revenue" |
| `submitted_payer_share_sar`, `submitted_patient_share_sar` | Σ `TotalPayerShare`, Σ `TotalPatientShare` | "submitted" |
| `claims_rejected`, `claim_rejection_rate` | headers whose outcome is a rejection ÷ headers with an outcome | counts only, no rejected amount |
| `order_lines_approved`, `order_line_approval_rate` | `SdDocumentLine` lines with `ApprovalStatus = 'A'` ÷ lines that needed approval (`A`, `P`, `R`, …; 800 confirms which letters mean "asked") | rate |

Dimensions: date, store, city, region, country, payer, claim outcome, line approval status, and
the sales channel family where the claim links to its till transaction.

- **Approved and paid amounts are not in v2.** They exist only inside `InsuranceAuthFhir.BundleJson`
  (FHIR), not as columns. Parsing a bundle in dbt is a separate decision, and fog.
- If 800 finds the claim headers or their outcome are not on the replica, this area shrinks to the
  order-line approval measures (`SdDocumentLine` is on the replica), and claims wait on a DBA task
  like 753.

## 4. Must not answer (adds to 741 §5)

The AI answers "I can't answer that from the analytics model" for:
- **margin, profit or cost**, including "estimated" margin;
- **approved, paid or adjudicated insurance amounts**: only *submitted* amounts exist;
- anything **per patient, per policy, per member id, or by diagnosis**. Diagnosis is health data,
  not a dimension, even aggregated;
- anything **per loyalty member or per coupon holder** (`CouponInstance.CustomerId`, `LoyId`), and
  any member's points balance;
- **SAP / IDoc** export status (use the SAP export console);
- coupon **issuing** and import jobs;
- loyalty **groups**.

Every PII column the survey found is barred from the model:
- loyalty: `LoyMember.FullName`, `BirthDate`, `Gender`, `NationalId`, `Email`, `Mobile`,
  `Nationality`, `InsuranceCompany`, `ReferralCode`, `CityName`, and `LoyGroupMember.Mobile`;
- tills and claims: `RetailTrx.LoyMobile`, the `RetailTrx.Insurance*` identity fields, and the
  claims' Patient*, MemberId, PolicyNumber, PolicyHolder, BeneficiaryName and IdentityNumber;
- people: `StaffId`, `UserId`, `CustomerId`, and `ItemInfo.CategoryManager`, which is a person's
  name.

The dbt tests assert that none of them reaches a mart column.

## 5. The evaluation seed for v2 (Q16–Q30)

They continue 741 §4's fifteen. Each entry becomes an evaluation case: the expected measures,
dimensions and filters, plus the rule that no number appears that the query did not return.

| # | Question | Measures · dimensions · filters |
|---|---|---|
| Q16 | **The acceptance case:** how did orders go per channel yesterday? Compare HungerStation with QC, and show each one's cancellation rate | `orders`, `cancellation_rate` · channel group; series 1 channel = HungerStation, series 2 delivery type = QC · yesterday (a period parameter) |
| Q17 | Cancellation rate by channel group, this week against last | `cancellation_rate` · channel group · compare previous |
| Q18 | Top 20 stores by cancelled orders, last 7 days | `cancelled_orders` · store · top 20 |
| Q19 | QC orders per day this month, and their median order-to-delivered time | `orders`, `order_to_delivered_min` p50 · day · delivery type = QC |
| Q20 | Coupon redemptions by campaign, last 30 days | `coupon_redemptions` · campaign |
| Q21 | Promotion discount value by city, this month against last | `promotion_discount_value_sar` · city · compare previous |
| Q22 | Top 10 bonus buys by discount value this week | `bonus_buy_discount_value_sar` · campaign, kind = bonus buy · top 10 |
| Q23 | Share of till sales with a promotion, by sales channel | `promoted_sales_share` · channel |
| Q24 | Points accrued against redeemed by month, year to date | `points_accrued`, `points_redeemed` · month · YTD |
| Q25 | New loyalty enrolments by store this week | `enrolments` · store · this week |
| Q26 | Outstanding points by tier, as of yesterday | `outstanding_points` · tier |
| Q27 | Loyalty redemption value in SAR by region, last 30 days | `redemption_value_sar` · region |
| Q28 | Claims submitted by payer last month, with the submitted payer share | `claims_submitted`, `submitted_payer_share_sar` · payer · last month |
| Q29 | Claim rejection rate by payer this quarter | `claim_rejection_rate` · payer |
| Q30 | Order-line insurance approval rate by payer, last 7 days | `order_line_approval_rate` · payer |

Q16 and Q17 also score the caveat: an answer that gives HungerStation's cancellation rate without
"inside OMS only" fails. Q31, "how many orders expired last week, and where", uses
`expired_orders` · store.

Refusal cases that join the set: "the margin on Panadol this month", "how much did Bupa pay us",
"top 10 members by points", "claims for diabetes", "which IDocs failed yesterday". Each one is
refused under §4 and names the screen or reason.
