# 804 — Which document sources and states define QC and a cancelled order?

Research for ticket [804](../../.issues/804-which-document-sources-and-states-define-qc-and-a-cancelled-order.md)
(map 793). It gives grilling ticket 796 the facts. It does not decide anything: each "recommendation"
below is for 796 to take or reject. BackOffice (`C:\Work\DMSCO\BackOffice`, "BO" below) was read only.
Replica: **reached** 2026-11-06 (`172.23.27.47` / `POS`, the `POS_REPLICA_READONLY` login, the
sanctioned `sqlcmd` shape from `741-replica-probe.sql`). Aggregates only, for the week **Sun 2026-10-25 →
Sat 2026-10-31** (`EntryTime >= '2026-10-25' AND < '2026-11-01'`). The queries are in the appendix (Q*/R*).

## Summary

- **QC = Quick Commerce = "Dawaa Now"**, the express delivery that OTO carries. It is a **delivery
  document type** (`DeliveryHeader.DeliveryDocumentType = 'QC'`). It is **not** a document source and
  **not** an order type. The order header (`SdDocumentHeader`) does not carry it.
- In that week all 3,952 QC deliveries came from the own app and web (`IOS` 3,011 · `WEB` 525 · `ROID` 416),
  and every one had `IsExpressDelivery = 1`. No other type was express. So all of QC falls inside v1's
  `own_app_web` group. Recommendation: make QC a **delivery-type dimension below the groups**, not a
  sixth channel group.
- **"Cancelled" means a close.** No status says "cancelled" in so many words. A document is cancelled when
  `SdDocumentHeaderStatus.CloseStatus` is a terminal close (`C`, `F`, `X`, `N`). The log shows it as
  `DCLS`/`DFCL`/`DCNI`/`DCAD` on a delivery and `OCLS`/`OFCL` on an order, each after a request close
  (`DRCL`/`ORCL`). Once an order has a delivery, the cancellation is recorded **on the delivery**. The
  order header stays at `CloseStatus = ''`, `OverallStatus = 'C'`.
- **Who cancelled is known only from the request-close row's `EntryUser`.** No reason code exists:
  `SdDocumentCloseAction.ReasonCode` is hard-coded `""` (0 of 11,168 rows set). The reason is only free
  text in the note. The final close is always written by `AutoClose`, so the closer tells you nothing.
  The request-close users are `AutoClose` = expiry (no person acted), `PH` = the store till,
  `Outbox` = the courier (OTO), `BJ_SYSTEM` = the platform (HungerStation / Deliverect). Any other user is
  a person or an API account, such as the app (customer) or a web operator.
- **The existing counter** is the store statistics' `ClosedOrCancelled` (ADR 0081). It counts a
  **delivery** once, on the **day of its first** `DCLS`/`DFCL`/`DCNI`/`DCAD`, against the delivery's
  store. Orders are not counted. The till, the `SdDocumentWeb/StoreStatistics` door and this repo's
  Delivery Statistics screen all read the same rows.
- **Expiry dominates and lags.** Of a week's deliveries closed, 3,446 closed the same day and 3,716 closed
  on **day 8**. The day-8 closes are the `AutoClose` expiry: 3,814 of its 3,822 requests came 7 or more
  days later. A rate dated by order date stays incomplete for about 8 days. A rate dated by close date
  puts different orders in the numerator and the denominator.
- **HungerStation shows almost no cancellations in OMS documents.** Only 25 of 21,361 HNGR deliveries
  closed (0.12%), every one an expiry, with no `BJ_SYSTEM` request. A cancellation on the platform is
  held in `DhOrderHeader.Status = 'CANCELLED'`, which is **not on the replica**. 🚩
- **Recommended rate (for 796):** the numerator is orders cancelled, split into *cancelled* (requested
  by a person, the store, the partner or the courier) and *expired* (requested by `AutoClose`). The
  denominator is all orders. Date both by the **order's `EntryTime`**, as v1's `orders` measure is.
  Leave out `N` (closed not invoiced: every one of them was delivered).

## QC — findings

| Fact | Source |
|---|---|
| `DeliveryDocumentTypeConstants.QuickCommerce = "QC"`, beside `DL`, `BB`, `LF`, `TB`, `GC`, `SP`, `VP`, `DLR` | BO `Sartawi.Retail.Data/Modules/Sd/Constants/DeliveryDocumentTypeConstants.cs:11-26` |
| The lookup row is `('QC', 'Quick Commerce', '', '', 'D')`, category D (delivery) | BO `Pricing/SIS.Pricing.Tests/Sd/CompetedDeliveryCalloutTests.cs:58-60` |
| "DocumentType (the order's type), DeliveryDocumentType (the delivery's own: DL, QC, BB, LF, ...), DocumentSource (the order's source)" — three separate keys | BO `.issues/assets/3306-1-callout-schema.sql:230-231` |
| `DeliveryHeader` has `DeliveryDocumentType` (l.34) and `IsExpressDelivery` / `ExpressCourierId` (l.119-120). `SdDocumentHeader` has only `DocumentType` / `DocumentSource` (l.33-34) | BO `Modules/Sd/Data/DeliveryData/DeliveryHeader.cs`, `Modules/Sd/Data/SdDocumentHeader.cs` |
| The caller (the e-commerce site) sets the type when the delivery is created. It is copied from `addDelivery`, together with `IsExpressDelivery` | BO `Modules/Sd/Services/DocumentService/SdDocumentService_Delivery.cs:1375, 1483, 1492-1498` |
| "Express (`QC`, Dawaa Now) deliveries under `CMRC`" | BO `.issues/2904-…-spec.md:174` |
| The quick-commerce fee `FQCD` = "Dawaa Now" express charge. OTO carries QC (`OtoCreateOrderHandler.cs:88`). The serving list notes "Quick Commerce reaches some 500 of 1000" stores | BO `CONTEXT.md:1531-1536, 2436-2437` |
| This repo's Deliveries **Dawaa Now** lens is `row.isExpressDelivery === true` | `src/features/oms/deliveries/lenses.ts:22` |
| v1 maps sources to groups only (`IOS`/`ROID`/`WEB`/`LNPG`/`HYBS`/`MGNT` → `own_app_web`, `HNGR` → `hungerstation`, …). The orders mart groups by `channel_group` × `document_type` (the order's type) and never reads `DeliveryHeader` | BO `Analytics/dbt/seeds/channel_map.csv:1-27`, `Analytics/dbt/models/marts/mart_orders_daily.sql:12-32` |

**Replica, week 10-25 → 10-31**

- Q2: QC deliveries by order source were `IOS` 3,011 · `WEB` 525 · `ROID` 416, all with
  `IsExpressDelivery = 1`. Every `DL`/`BB`/`TB`/`GC` row had `IsExpressDelivery = 0`. So in that week
  **QC ⇔ express**.
- Q1: the orders of those sources all have order type `CMRC`. QC cannot be seen in the order type.
- Q5: 113,485 orders had one delivery, 541 had two, 2 had three, and 1,862 had none. An order-grain QC
  flag therefore needs a rule for the rare multi-delivery order (any QC delivery → QC).
- 🚩 Q0: the replica's `DeliveryDocumentType` lookup has **no QC row** (`BB, DL, GC, PK, SP, TB, VP, WSRF`),
  yet `DeliveryHeader` holds 3,952 QC rows. A model that inner-joins the lookup for a label would drop
  QC. Label it from the semantic model, not from the lookup.

**Recommendation (796 decides).** QC is a *fulfilment type* inside `own_app_web`, not a separate place
the order came from. Adding it as a sixth channel group would split a source's orders by how they were
delivered, so the channels would stop adding up to the source's orders. Instead:

- add **`delivery_type`** (`DeliveryHeader.DeliveryDocumentType`: QC, DL, BB, LF, TB, GC, …) as a
  dimension of the orders and deliveries areas, joined `DeliveryHeader.RefDocumentNo = SdDocumentHeader.DocumentNo`,
  with "any QC delivery" for the rare multi-delivery order;
- or add a narrower `is_quick_commerce` flag.

The owner's example ("two order types, HungerStation and QC") then reads as *channel = HungerStation*
compared with *delivery type = QC*. Both slices are well defined and they do not overlap, because no
HNGR order produced a QC delivery (Q2).

## Cancelled — states and events

| Level | Request | Close | `CloseStatus` set | Source |
|---|---|---|---|---|
| Order (cat O) | `ORCL` → `R` | `OCLS` → `C`, and also `OverallStatus = C`. `OFCL` → `C` (not `F`) | `R`, `C` | BO `SdDocumentService_Update.cs:1198-1261` |
| Delivery (cat D) | `DRCL` → `R` (the note is kept in `HeaderNote`) | `DCLS` → `C` + `OverallStatus = C`. `DFCL` → `C`. `DCNI` → `N`. `DCAD` → `X` | `R`, `C`, `N`, `X` | BO `SdDocumentService_Delivery.cs:4435-4446, 4491-4537` |
| Constants | | | `R` requested · `C` closed · `X` cancelled after delivery · `F` force closed · `N` not invoiced | BO `Modules/Sd/Constants/DocumentCloseStatusConstants.cs:5-9`, action codes `DocumentActionTypeConstants.cs:11-36, 78-85` |

- **`F` is never written.** Both force closes write `C` (`SdDocumentService_Update.cs:1256`,
  `SdDocumentService_Delivery.cs:4523`). Predicates that list `F` are harmless but dead.
- **A close is a cancellation, never a completion.** See the glossary entry **Close** in oms-react
  `CONTEXT.md:169-185`. BO's notification policy treats a move into `C`/`F`/`X`/`N` as Cancelled, and `R`
  as not yet an outcome (BO `Modules/NotificationCenter/Producers/NewOrderResolutionPolicy.cs:16-23, 41-45`).
  Note that a close request is now final (`CONTEXT.md:173-176`).
- **The flow.** A request (`ORCL`/`DRCL`) queues an `SdDocumentCloseAction`. The `ClosingProcessBackground`
  worker, running as user `AutoClose`, then writes the close (`OCLS`/`DCLS`)
  (BO `Services/SIS.Api/ClosingProcess/ClosingProcessBackground.cs:13-16, 45, 60`;
  `SdDocumentService_CloseAction.cs:400-430`). The same worker's `QueueingCloseActions` also *requests*
  the close of documents that are past `ValidTo`, past the slot end + 2 h or past the hand-over limit.
  That is the **expiry** path (`SdDocumentService_CloseAction.cs:218-330`).
- **The order or the delivery?** Delivery creation does not cascade a close to the order, and a
  delivery close does not either (`SdDocumentService_Delivery.cs:4543-4560`). On the replica (Q4), every
  order that has a delivery sits at order `CloseStatus = ''` / `OverallStatus = 'C'`. An order-level
  `C` (767 that week, every one closed by `AutoClose`) occurs **only on orders with no delivery**: call
  centre (`CFLO` 224, `CINB` 106, `CCHT` 71…), `LNPG` 180, `CLNC` 60, `P2E` 52. So "order cancelled" =
  the order's own `CloseStatus = 'C'` **or** its delivery's terminal close.
- **`N` is not a customer cancellation.** All 303 `DCNI` deliveries that week also had `DDLR` delivered
  (Q10), with `DeliveryStatus = D` (Q3). `X` (`DCAD`, 40) occurred only on Altibbi (`TB`).

### Who cancelled — attribution

- **There are no reason codes.** `ReasonCode = ""` is hard-coded on both paths
  (BO `SdDocumentService_Update.cs:1278`, `SdDocumentService_Delivery.cs:4556`). On the replica (R5),
  0 of 10,114 delivery and 1,054 order close actions carry one. The operator's reason is the note text:
  the picker's list *is* the note (`src/core/constants/cancel-reasons.ts:9-10, 17-28`). R4: the requests
  by `PH` and by other users carry notes, while the `AutoClose` and `Outbox` requests are empty.
- **The requester is the `EntryUser` of the `DRCL`/`ORCL` log row** (`SdDocumentLog.EntryUser`, BO
  `Modules/Sd/Data/SdDocumentLog.cs:12`). The `DCLS` that follows is always `AutoClose` (Q6: `DCLS`
  8,040 / 519, every one by `AutoClose`).

| `EntryUser` on the request | Who | Source |
|---|---|---|
| `AutoClose` | expiry: nobody acted | BO `DocumentCloseUserConstants.cs` ("EXPIRED, not cancelled" for lab bookings), `ClosingProcessBackground.cs:15` |
| `PH` | the store's till (the till fleet's api-key user) | BO `Modules/Attachments/Constants/AttachmentAcceptList.cs:26-30` (⚠ "DEV key row's value; production's is unverified"). It is allowed as a system closer at `SdDocumentService_Delivery.cs:4412-4414` |
| `Outbox` | the courier: an OTO cancel, OTO auto-cancel (no driver) or SLNK | BO `Outbox/Handlers/Oto/OtoAutoCancelHandler.cs:130-144`, `OtoStatusSyncHandler.cs:265-276` |
| `BJ_SYSTEM` | the platform: a HungerStation cancel (direct rail, with `Note = order.Comment`) or a Deliverect cancel (`Note = "Cancelled by the platform: {PlatformKey} #{DisplayId}"`) | BO `DeliveryHero/Outbox/Handlers/SyncOrderHandler.cs:103-115`, `Deliverect/DeliverectOrderService.cs:51, 307-334` |
| anything else | a person or an API account: the customer app, a web operator, the call centre | R3: one account made 1,344 of the 1,505 `IOS` "other" requests and one made 448 of `ROID`'s 477, so it is very likely the app (the customer). Owed: confirm which account it is |

- A HungerStation cancel payload carries `cancellation.reason` and `cancelled_by`
  (`DeliveryHero/Models/ReceiveOrder/DeliveryHeroCancellation.cs:7-9`), but `DhOrderHeader` stores
  neither (`Data/Order/DhOrderHeader.cs`, no such field), so the platform's side of who cancelled is lost.
- A courier's cancel reason is kept only for **callout** deliveries
  (`Modules/Callouts/Delivery/DeliveryCourierCancelRecorder.cs:12-17`), and callouts are not on the replica.
- Q7 / R6, the requesters for the week's deliveries:

| | same day | 1–6 days | ≥ 7 days |
|---|---|---|---|
| other (person / app) | 1,840 | 578 | 22 |
| `PH` store | 1,284 | 700 | 23 |
| `Outbox` courier | 287 | 6 | 0 |
| `AutoClose` expiry | 1 | 4 | 3,814 |

  QC requests: `Outbox` 293 · `PH` 225 · other 1. A store **cannot** cancel a QC (Dawaa Now) delivery
  itself unless it is returned, OTO-cancelled or a system user acts
  (`SdDocumentService_Delivery.cs:4412-4424`).

### What existing counters count

| Counter | Predicate (exact) | Grain · date · scope | Source |
|---|---|---|---|
| Store statistics `ClosedOrCancelled` ("Closed / cancelled") | `l.ActionType IN ('DCLS','DFCL','DCNI','DCAD')` on `SdDocumentLog l JOIN DeliveryHeader d ON d.DeliveryNo = l.DocumentNo`. Its first-ever time per delivery goes into `SdStoreStatFirstEvent` | **delivery**, once · the **day of the first close event** · the delivery's own store (the log's `StoreCode` is never read) · dims: `RefDocumentType`, `DeliveryType`, `IsChurnedRefill` (no source, no delivery type) | BO `Modules/Sd/Services/StoreStatistics/SdStoreStatsAggregator.cs:40-45, 314-319, 337-376`; `SdStoreStatMetrics.cs:20-25`; ADR `docs/adr/0081-store-statistics-count-each-delivery-once-on-its-first-event.md:3-10` |
| Store statistics `CloseRequested` | `l.ActionType = 'DRCL'`, first-ever | same | `SdStoreStatsAggregator.cs:360` |
| Its "came in" (the natural denominator) | `DeliveryHeader.EntryTime` | delivery · its entry day | `SdStoreStatsAggregator.cs:339-344` |
| Read filters | `IsChurnedRefill = 0` by default (churned Wasfaty refills are left out). Optional `DocumentType NOT IN @LeaveOutTypes` | — | BO `SdStoreStatisticsService.cs:74-80`; `Models/StoreStatistics/StoreStatisticsOptions.cs:21-25` |
| Till (POS) dashboard | reads `SdDocument/StoreStatistics`: `misses.ClosedOrCancelled` → "Closed / cancelled" | same rows | BO `Sartawi.POS/OMS/Dashboard/OmsStatisticsDashboard.cs:15, 157, 480` |
| Web `SdDocumentWeb/StoreStatistics` | "the same rows and arithmetic as the till's" door | same rows | BO `Services/SIS.Api/Endpoints/Sd/SdDocumentWebEndpoints.cs:86-98` |
| oms-react Delivery Statistics | renders the server's `closedOrCancelled` tile ("Closed / cancelled") | same rows | `src/features/oms/delivery-statistics/DeliveryStatisticsPage.tsx:87`, `src/locales/en/delivery-statistics.json:92` |
| oms-react Deliveries timeline / status | `close === 'C' \|\| close === 'N' \|\| close === 'X'` → cancelled. `'R'` → requested. Cancelled events `['DCLS','DFCL','DCNI','DCAD']` | a delivery's current state | `src/core/oms/timeline.ts:78-82, 219` |
| oms-react Deliveries lens "Cancellation requested" | `row.closeStatus === 'R'` | loaded rows | `src/features/oms/deliveries/lenses.ts:21` |
| HungerStation Orders monitor `cancelled` | HungerStation's own `DhOrderHeader.Status = 'CANCELLED'`, which "wins over" `created` (a document exists) | HS order | BO `DeliveryHero/Web/HungerStationOrderMonitorService.cs:26-29` |
| Deliverect Orders `cancelled` | `DlvOrderHeader.Outcome` / `CancelReceivedAt` | Deliverect order | BO `Deliverect/Data/DlvOrderHeader.cs:37, 73` |

**Contradictions**

- 🚩 **Store statistics count a delivered delivery as closed too.** `DCNI` (`N`) and `DCAD` (`X`) are
  in `ClosedOrCancelled`, and each metric is first-ever on its own, so a delivery can count in both
  `Delivered` and `ClosedOrCancelled`. That week all 303 `DCNI` were delivered (Q10). A
  `Delivered + ClosedOrCancelled` total over-counts by those.
- 🚩 **The till and web counters measure deliveries by close date. The HungerStation and Deliverect
  monitors measure the platform's order by the platform's status.** For HungerStation the two disagree:
  only 25 HNGR deliveries closed, every one an expiry, and no `BJ_SYSTEM` `DRCL` happened (Q7). Either
  platform cancels mostly happen before a document exists (the 318 HNGR orders with no delivery and no
  close status, Q4, may be those), or the `SyncOrderHandler` cancel path does not fire. `DhOrderHeader`
  and `DlvOrderHeader` are **not on the replica** (R1, R2), so the platform-side count is owed.
- 🚩 **A timeline gap.** `timeline.ts:81` leaves out `F` while BO's policy includes it. This is
  harmless today, because nothing writes `F`.
- 🚩 *(aside, relevant to channel comparisons)* The order sources `COBE` 2,859 · `COBC` 2,776 · `CFLO` 1,803
  · `COBM` · `CINS` (all type `CLCN`, call centre) and `INTG`, `RGSW` are **not in `channel_map.csv`**,
  so v1 counts them as `other`: about 7.4k call-centre orders a week. The nightly test
  `channel_map_covers_recent_sources` should be listing them.

## The rate

| | Store statistics (today) | Recommendation for 796 |
|---|---|---|
| Grain | delivery | **order** (`SdDocumentHeader` cat O), the same grain as v1's `orders` measure (741 §3) |
| Numerator | deliveries whose first `DCLS`/`DFCL`/`DCNI`/`DCAD` falls in the period | orders where the order's `CloseStatus = 'C'` **or** a forward delivery (cat D) has `CloseStatus IN ('C','X')`. Leave out `N` (delivered, closed not invoiced) |
| Split | none | **cancelled** (the request's `EntryUser` ≠ `AutoClose`: customer/app, store `PH`, courier `Outbox`, platform `BJ_SYSTEM`) and **expired** (`AutoClose`). The owner's "cancellation rate" is most likely the first |
| Denominator | none: the screens show counts, not a rate. The natural pair is Came in (entry date) | **all orders** of the same cohort. Leave out the churned Wasfaty refills only if 796 adopts the store statistics' default. **No test-order flag** exists on `SdDocumentHeader` (no such field) |
| Date | the first close event's day | the **order's `EntryTime`** (cohort), capped at today. Then numerator and denominator are the same orders, and periods add up |

Why: by close date, "yesterday's rate" would divide orders from 8 days ago (the expiries) by
yesterday's orders. By order date the figure is complete for person, store and courier cancels within
about a day (other 75%, `PH` 64%, `Outbox` 98% on the same day, R6). Only expiries need about 8 days,
which is one more reason to show them apart. The page should show recent days as "may still rise" or
leave expiry out of the headline.

**Indicative week, by delivery**, `closed` = `CloseStatus IN ('C','F','N','X')` (R7). This is not the
recommended measure.

| Slice | deliveries | closed | rate |
|---|---|---|---|
| HNGR · DL | 21,361 | 25 | 0.1% |
| QC (IOS+WEB+ROID) | 3,952 | 519 | 13.1% |
| IOS · DL | 42,007 | 3,048 | 7.3% |
| INSP · DL | 18,026 | 304 (205 without `N`) | 1.7% (1.1%) |

## Open points / owed facts

1. **The HungerStation platform cancels.** Count `DhOrderHeader.Status = 'CANCELLED'` by week on the
   OMS application database, because the table is not on the replica. Find out whether those orders
   ever get an `SdDocumentHeader`, and why no `BJ_SYSTEM` `DRCL` appeared that week. Without this,
   HungerStation's cancellation rate from OMS documents is ~0 and misleading.
2. Which account made the dominant "other" `DRCL` on `IOS`/`ROID` (R3: one account each)? Is it the
   app's API user, so that it means the customer?
3. `PH` as the production till user is "unverified" in BO (`AttachmentAcceptList.cs:26-28`). The replica
   shows 2,007 `PH` requests, which suggests it is right.
4. The QC row is missing from the replica's `DeliveryDocumentType` lookup (Q0). Check the application DB.
5. `INSP` order type `JAHA` (95 orders, `DocumentTypeConstants.Jaha`): is it Jahez? This matters if 796
   wants partners beyond HungerStation. No Deliverect (`DLCT`) orders appeared that week (Q1).
6. 796 decides: whether a cancelled order includes expiries, whether `N` is out, and whether it is
   delivery type or a QC flag.

## Sources

- BackOffice (read-only): `Sartawi.Retail.Data/Modules/Sd/Constants/{DeliveryDocumentTypeConstants,DocumentActionTypeConstants,DocumentCloseStatusConstants,DocumentCloseUserConstants,DocumentTypeConstants,DocumentSourceConstants}.cs`;
  `Modules/Sd/Data/{SdDocumentHeader,SdDocumentHeaderStatus,SdDocumentLog}.cs`, `Data/DeliveryData/DeliveryHeader.cs`,
  `Data/CloseActionData/SdDocumentCloseAction.cs`; `Modules/Sd/Services/DocumentService/{SdDocumentService_Delivery,SdDocumentService_Update,SdDocumentService_CloseAction}.cs`;
  `Services/SIS.Api/ClosingProcess/ClosingProcessBackground.cs`; `Modules/Sd/Services/StoreStatistics/{SdStoreStatsAggregator,SdStoreStatMetrics,SdStoreStatisticsService}.cs`;
  `Modules/Sd/Services/Models/StoreStatistics/StoreStatisticsOptions.cs`; `Services/SIS.Api/Endpoints/Sd/SdDocumentWebEndpoints.cs`;
  `Sartawi.POS/OMS/Dashboard/OmsStatisticsDashboard.cs`; `Modules/NotificationCenter/Producers/NewOrderResolutionPolicy.cs`;
  `Modules/Sd/DeliveryHero/{Outbox/Handlers/SyncOrderHandler.cs,Models/ReceiveOrder/DeliveryHeroCancellation.cs,Data/Order/DhOrderHeader.cs,Web/HungerStationOrderMonitorService.cs}`;
  `Modules/Sd/Deliverect/{DeliverectOrderService.cs,Data/DlvOrderHeader.cs}`; `Modules/Sd/Outbox/Handlers/Oto/{OtoAutoCancelHandler,OtoStatusSyncHandler}.cs`;
  `Modules/Callouts/Delivery/DeliveryCourierCancelRecorder.cs`; `Modules/Attachments/Constants/AttachmentAcceptList.cs`;
  `Pricing/SIS.Pricing.Tests/Sd/CompetedDeliveryCalloutTests.cs`; `.issues/assets/3306-1-callout-schema.sql`; `.issues/2904-…-spec.md`;
  `docs/adr/0079-…md`, `docs/adr/0081-…md`; `CONTEXT.md`; `Analytics/dbt/seeds/{channel_map,channel_groups}.csv`, `seeds.yml`,
  `Analytics/dbt/models/marts/mart_orders_daily.sql`.
- oms-react: `CONTEXT.md` (Close), `docs/research/741-v1-semantic-model.md`, `src/core/oms/timeline.ts`,
  `src/features/oms/deliveries/lenses.ts`, `src/features/oms/delivery-statistics/DeliveryStatisticsPage.tsx`,
  `src/locales/en/delivery-statistics.json`, `src/core/constants/cancel-reasons.ts`.
- Replica `172.23.27.47` / `POS`, run 2026-11-06. The queries are below.

## Appendix — the replica queries (read-only, aggregates, `@f = '2026-10-25'`, `@t = '2026-11-01'`)

- **Q0** `SELECT DocumentType, Description FROM DeliveryDocumentType`
- **Q1** `SdDocumentHeader` cat O in the week, `COUNT_BIG(*)` by `DocumentSource`, `DocumentType`
- **Q2** `DeliveryHeader` in the week, by `DeliveryDocumentType`, `RefDocumentSource`, `IsExpressDelivery`
- **Q3** the same, `LEFT JOIN SdDocumentHeaderStatus s ON s.DocumentNo = d.DeliveryNo`, by type, `CloseStatus`, `OverallStatus`, `DeliveryStatus`
- **Q4** orders of the week by source, the order's `CloseStatus`/`OverallStatus`, and `EXISTS(DeliveryHeader WHERE RefDocumentNo = h.DocumentNo)`
- **Q5** deliveries (cat D) per order of the week
- **Q6** `SdDocumentLog` rows `IN ('DRCL','DCLS','DFCL','DCNI','DCAD')` on the week's deliveries, by type, action, `EntryUser` bucketed to `AutoClose`/`Outbox`/`BJ_SYSTEM`/`PH`/other
- **Q7** the `DRCL` requester bucket by order source (distinct deliveries)
- **Q8** `ORCL`/`OCLS`/`OFCL` on the week's orders, by bucket. Result: `OCLS` `AutoClose` 767 · `ORCL` `AutoClose` 540 / other 206 / `PH` 22
- **Q9** days from the delivery's entry to its first close: day 0 3,446 · 1 825 · 2 324 · 3 155 · 4 113 · 5 94 · 6 74 · 7 28 · **8 3,716** · 9 111 · 10+ 16
- **Q10** deliveries with both `DDLR` and a close: `DCNI` 303 only
- **R1/R2** `DhOrderHeader`, `DlvOrderHeader`: MISSING on the replica
- **R3** "other"-user `DRCL` by source: the number of distinct users and the top user's count (no names)
- **R4** `DRCL` note empty or set, by bucket · **R5** `SdDocumentCloseAction.ReasonCode` empty or set · **R6** days from entry to `DRCL` by bucket · **R7** closed deliveries by source × type
