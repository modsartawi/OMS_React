# 741 — The v1 semantic model: subject areas, measures, dimensions, questions

Settled in ticket [745](../../.issues/745-which-subject-areas-measures-and-questions-does-v1-answer.md)
(grilling with the owner, 2026-11-03). Facts below were checked live against the prod replica
(`172.23.27.47` / `POS`) and the BackOffice source the same day. Aggregates only.

## 1. Subject areas, ranked

| Rank | Area | Source on the replica | State |
|---|---|---|---|
| 1 | **Till sales** (with loyalty share, Bahrain, NPHIES-linked as slices) | `RetailTrx` (NCCI columnstore) | ready |
| 2 | **Orders by channel** | `SdDocumentHeader` cat. O + `SdDocumentSource` | ready (no columnstore → rollup for wide windows) |
| 3 | **Delivery speed** | `SdDocumentLog` first events + `DeliveryHeader` + the order header | ready (no columnstore → rollup) |
| 4 | **Callouts and donor requests** | `Callout`, `CalloutBid`, `CalloutEvent`, `DonorRequest*` | **not on the replica** — gated on ticket 753 |

Insurance as an area (claims, approvals, Nphies outcomes) is **not v1**: the replica holds no claim
outcome. Only the NPHIES-linked flag on a till sale is in v1, as a slice of area 1.

### Correction to 723

723 said delivery speed is "not measurable on the replica". That was true only of
`SdDocumentHeaderAction`. On 2026-10-27 → 11-02 the replica held:
- `SdDocumentLog`: 110,443 deliveries with both a `DCRT` (created) and a `DDLR` (delivered) event,
  mean ≈ 258 min; 117,703 `DDLR` and 39,094 `DOFD` events in total;
- `DeliveryHeader`: 129,627 rows, 116,212 with a real `ActualDeliveryTime`; `0001-01-01` is the
  unset sentinel (every row is non-null, so a NULL test is wrong).

## 2. Shared dimensions

| Dimension | Definition |
|---|---|
| Date | the fact's own date, **capped at today** (bad till clocks write 2028/2029). Grains: day, week, month |
| Week | **starts Sunday** (Saudi business week) |
| Store | store code + name, from `Store` |
| City, region | from `Store` / `StoreArea` / `BusinessAddress` — the same joins the dispatch scorecard uses |
| Country | KSA, or Bahrain where `DocumentCurrency = 'BHD'` |
| Channel (orders, deliveries) | `DocumentSource` → five groups: own app + web · HungerStation · insurance platform · call centre · other (clinics, P2E, ERX, Dawaok). The mapping table is one file of the semantic model; 717's channel table is its first check |

No customer, loyalty-member, staff, product or material dimension exists (§5).

## 3. Measures

### Till sales — grain: one `RetailTrx` header

Base filter: `TrxStatus = 1`, `TrxType IN (100, 110)`. `TrxType 700` (finance-only) never counts.
`rate` = `ExchangeRate` when > 0, else 1 (Bahrain lines carry 10).

| Measure | Definition | Label |
|---|---|---|
| `till_sales` | count, `TrxType = 100` | Till sales |
| `till_returns` | count, `TrxType = 110` (returns carry positive amounts) | Returns |
| `gross_till_value_sar` | Σ `Amount × rate`, sales only | Sales value through our tills, before returns |
| `net_till_value_sar` | Σ sales `Amount × rate` − Σ returns `Amount × rate` | **Value through our tills** — never "revenue" |
| `return_rate` | `till_returns / till_sales` | Return rate |
| `loyalty_identified_share` | sales with `LoyaltyCustomerID` not in (`''`, `3795407`, `3378`, `1000000004`) / `till_sales` | Share identified to a loyalty member |
| `order_linked_share` | sales with `OrderNo` set / `till_sales` | Share linked to an OMS order |
| `nphies_linked_sales` | sales with `NphiesEligibilityId` set | Insurance (NPHIES-linked) sales |

### Orders — grain: one `SdDocumentHeader` row, `DocumentCategory = 'O'`, dated by `EntryTime`

| Measure | Definition |
|---|---|
| `orders` | count |

### Delivery speed — grain: one delivery

Each event time is the delivery's **first-ever** event of that type in `SdDocumentLog`, as BackOffice
ADR 0081 rules for store statistics (one rule estate-wide): `DCRT` created, `DRDY` ready,
`DOFD` out for delivery, `DDLR` delivered. The order's time is its order header's `EntryTime`.
`0001-01-01` anywhere is null.

| Measure | Definition |
|---|---|
| `deliveries` | count of deliveries created in the period |
| `deliveries_delivered` | those with a `DDLR` |
| `deliveries_not_delivered` | those without — counted, never given a time |
| `order_to_delivered_min` (median, p90) | first `DDLR` − order `EntryTime` |
| `ready_to_delivered_min` (median, p90) | first `DDLR` − first `DRDY` |
| `same_day_share` | delivered on the order's calendar date / `deliveries_delivered` |

Percentiles are **PERCENTILE.INC** (interpolated), the same as `DispatchScorecardMath.Percentile`.

### Callouts — gated on 753

The measures are **SQL twins** of `DispatchScorecardMath` (BackOffice `Modules/Callouts/Scorecard`),
not new definitions. The acceptance check is parity with the dispatch scorecard door over the same
window and filters.

| Measure | Scorecard figure |
|---|---|
| `callouts` | callouts opened (`Callout.OpenedAt`) |
| `take_rate` | `WinRate` |
| `failed_take_rate`, `failed_takes` | `FailedTakeRate`, `FailedTakes` |
| `median_answer_seconds` | `MedianAnswerSeconds` |
| `median_km` | `MedianKm` |
| `ignore_rate`, `decline_rate` | `IgnoreRate`, `DeclineRate` |
| `radius_widened` | deliveries whose later callout round has a larger `SearchRadiusKm` than the first (check against spec 3326's widen events when building) |

Grouped by store, city and region only — **never by person** (the scorecard's per-staff rows are
not in v1).

### Donor requests — gated on 753

| Measure | Definition |
|---|---|
| `donor_requests_raised` | `DonorRequest` rows by `RaisedAt` |
| `donor_requests_filled` | `State IN ('FULFILLED', 'TRANSFERRED')` |
| `donor_fill_rate` | filled / raised |
| `median_fill_min` | `FulfilledAt − RaisedAt`, filled only |
| `donor_requests_cancelled` | `State = 'CANCELLED'`, split by `Outcome` (CANCELLED, REFUSED, EXPIRED) |

## 4. The fifteen questions v1 must answer (the evaluation seed)

| # | Question | Measures · dimensions · filters |
|---|---|---|
| Q1 | Net till value by city this month versus last | `net_till_value_sar` · city · month, compare previous |
| Q2 | Top 20 stores by till sales this week | `till_sales` · store · this week, top 20 |
| Q3 | Loyalty-identified share by region, last 4 weeks | `loyalty_identified_share` · region · 28 days |
| Q4 | Return rate by store, last 30 days | `return_rate` · store · 30 days |
| Q5 | Orders by channel per day, this week versus last | `orders` · channel, day · compare previous |
| Q6 | HungerStation orders in Riyadh, this week versus last (734 demo story 2) | `orders` · channel = HungerStation, city = Riyadh · compare previous |
| Q7 | Share of till sales linked to an OMS order, by month | `order_linked_share` · month |
| Q8 | Median and p90 order-to-delivered time by channel, last 7 days | `order_to_delivered_min` p50/p90 · channel · 7 days |
| Q9 | Share delivered the same day, by city | `same_day_share` · city |
| Q10 | Stores with the slowest median ready-to-delivered time this month | `ready_to_delivered_min` p50 · store · this month, sorted desc |
| Q11 | Callout take rate and median time-to-take by city, this week | `take_rate`, `median_answer_seconds` · city · this week |
| Q12 | How often the search radius widened, and the failed-take rate, by store | `radius_widened`, `failed_take_rate` · store |
| Q13 | Donor requests raised versus filled, and the median fill time, last 30 days | `donor_requests_raised`, `donor_requests_filled`, `median_fill_min` · 30 days |
| Q14 | Bahrain till value in SAR, year to date | `net_till_value_sar` · country = Bahrain · YTD |
| Q15 | Insurance (NPHIES-linked) till sales by city, last 30 days | `nphies_linked_sales` · city · 30 days |

Q11–Q13 wait on 753. Each entry becomes an evaluation case: expected measures, dimensions and
filters, plus the rule that no number appears that the query did not return.

## 5. What v1 must not answer

The AI answers "I can't answer that from the analytics model" for:
- anything **per customer or per loyalty member** (no such dimension exists; no PII member is declared);
- anything **per staff member** (scorecard person rows, cashier rankings);
- **revenue, margin, profit or cost** — only "value through our tills" exists;
- **product or material mix** (no product dimension at header grain; a v2 area over `RetailTrxDetail`);
- **forecasts** or predictions;
- **insurance approvals, claims or Nphies outcomes** (not on the replica);
- **SAP posting, IDocs, coupons or campaigns by engine** (not replicated);
- the contents of **free-text fields** (`Callout.ReleaseNote`, `DonorRequestEvent.Reason`/`Detail`/`ComplaintRef`, notes);
- single-order lookups ("why was order X late") — those are 734's `order_timeline` and `order_delay_facts`.

## 6. One definition with spec 734

- 734's `sales_summary`, `orders_by_channel` and `callout_stats` cover the same ground as §3. Each
  of their figures **is** the §3 measure of the same meaning. Ticket 746 decides the mechanics
  (the tool reads the semantic layer, or both read one rollup).
- `order_timeline` and `order_delay_facts` stay outside the semantic model, but they use the same
  first-event rule as §3's delivery speed.
