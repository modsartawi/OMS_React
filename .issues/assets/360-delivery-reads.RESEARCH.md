# 360 — What the delivery reads give us (research)

For [What the delivery reads give us](../360-what-the-delivery-reads-give-us.md), wayfinder map 358,
on 2026-10-02.

**Sources.** Paths are relative to `C:\Work\DMSCO\BackOffice` unless they start with `oms-react/`.
Nothing was edited in either repo.

**Dev SIS.Api was not reachable** on `:5111` (connection refused), so this note has **no observed
latency**. The cost below is read from the code.

**The web door is a pass-through.** Every `SdDocumentWeb/*` handler calls its `SdDocumentEndpoints`
twin. Cost and payload are the same as on the old door; only the grant gate differs
(`Services/SIS.Api/Endpoints/Sd/SdDocumentWebEndpoints.cs:31-34, 114-150`).

- The list is gated by `OmsListGrantEndpointFilter`.
- The detail reads (Document, Delivery, Logs, Outbox) are gated by `OmsDetailGrantEndpointFilter`
  (`:78-84, 257-271`).

---

## 1. Total count: there isn't one

`DeliveryDocumentList` returns a bare array, cut by `TOP (@Limit)`. It carries no total, no
`hasMore` and no "truncated" flag. No endpoint the browser may call counts deliveries for a set of
criteria.

**The cap**

- `Limit` is a query parameter. The server defaults it to **500** when absent and caps it at
  **20,000** (`Sartawi.Retail.Data/Modules/Sd/Services/DocumentService/SdDocumentService_Inquiry.cs:473-478`).
- oms-react always sends `Limit`, default **200** (`oms-react/src/features/oms/deliveries/filter.ts:4, 66`).
- The SQL is `SELECT TOP (@Limit) * FROM Delivery WHERE … ORDER BY Delivery.DeliveryNo DESC`
  (`Sartawi.Retail.Data/Modules/Sd/Services/SdSqlStatements.cs:404-440`).
- The envelope adds nothing countable (`Modules/Core/Response/HttpResponses/HttpGeneralResonse.cs:20-62`).
- **The only truncation signal is `rows.length === Limit`.** It means "there may be more", never
  how many.

**What the query hits**

- The CTE joins `DeliveryHeader` to 7 tables with INNER joins and to about 7 more with LEFT joins:
  `SdDocumentHeader`, customer, status, type/source/delivery-type lookups, note, reschedule reason
  and address (`SdSqlStatements.cs:337-403`).
- 11 optional `(@X IS NULL OR …)` predicates. Four of them compare lookup **description text**,
  not codes: DeliveryType, DocumentType, DocumentSource, DeliveryDocumentType.
- The date range (`EntryTime >= @FromDate AND < @ToDate`) is applied only when DocumentNo, OrderNo
  and DeliveryNo are all empty **and** both dates are set (`SdDocumentService_Inquiry.cs:484-490`).
  Otherwise the search has no date bound.
- After the page is cut, an `OUTER APPLY` counts each row's `F` outbox rows into
  **`FailedJobsCount`**, with a seek on the filtered index `IX_SdDocumentOutbox_Failed_ByDoc`
  (`SdSqlStatements.cs:422-438`; `Modules/Sd/Sql/003_index_sd_document_outbox_failed.sql:7-9`).

**Indexes**

- `DeliveryHeader` had only its PK on `DeliveryNo` until 028 added `(RefDocumentNo,
  ReferenceDeliveryNo)` (`Modules/Sd/Sql/028_index_delivery_header_ref_document_consignment.sql:4-7`).
- `(StoreCode, CustomerId)` was shipped unapplied on purpose
  (`026_index_delivery_header_store_customer.sql:3-7, 27-29`).
- **No repo script indexes `EntryTime`.** The production index set and the table size are
  **unknown**. For scale, `SdDocumentHeader` is about 14.9M rows
  (`.issues/1329-backfill-runbook-and-covering-index.md:69`).

**Existing counts don't fit**

- `SdDocument/UnpreparedDocumentCount/{store}`, `ExpressDeliveryCount/{store}` and
  `DeliveredPickingStatusCount/{store}` use fixed predicates and are cached for 30 s
  (`SdDocumentEndpoints.cs:248-254, 461, 1167-1210`).
- All three are **API-key only**, with no cookie session, so a browser gets 403
  (`Services/SIS.Api/Auth/ApiKeyEndpointFilter.cs:49-61`).
- BackOffice 2201 weighed a count endpoint for the WPF dashboard and **chose to project over the
  loaded list instead** (`.issues/2201-where-the-dashboards-numbers-come-from.md:13-20, 49-50, 78`).
- 2221 (open) plans `GET StoreStatistics` over a summary table. That is not a criteria count.

**If one were asked for**

- `SELECT COUNT(*)` can reuse the CTE and the WHERE clause word for word, dropping the `OUTER
  APPLY` and the `ORDER BY`.
- It must **keep the INNER joins**, or its total will disagree with the rows.
- It is not cheap. `TOP` stops early while walking `DeliveryNo DESC`, but a count must visit every
  match, and `EntryTime` has no index. Without a date range it counts the whole table.
- The nearest measured relative is `/SdDocument/DocumentList` at **1.29 s average**, the server's
  top cost in BackOffice 2104 (`.issues/2104-…md:120-121`). That is a different query, and
  `DeliveryDocumentList` itself is unmeasured.
- A count per view, re-run on refresh, multiplies that cost.

---

## 2. Cost of the details read: heavy, not J/K-safe raw

**One `Delivery/{no}` call** costs about **10–12 DB round trips plus one per line**. It runs the
legacy pricing engine in memory **twice**. Lines come inline; Log and Jobs do not. There is no
caching.

Trace of `GetDeliveryModel` (`Modules/Sd/Services/DocumentService/SdDocumentService_Delivery.cs:77-109`):

1. **The NHibernate load** fetch-joins status, customer, note, shipping address, and lines with
   their line status. One query (`SdDocumentService_Core.cs:442-456, 474-485`).
2. **Legacy pricing** runs unless the delivery is stamped SISPRICING; a SISPRICING delivery reads
   only stored rows (`SdDocumentService_Core.SisPricing.cs:35-36, 108-113`).
   - Plant, tax classification and FX: 2–3 trips (`Logistics/Pricing/Service/PricingRepoService.cs:93-129`).
   - Stored conditions: 1 query (`SdDocumentService_AsRecorded.cs:59-78`).
   - **N+1:** `FillItem` runs once per line, each on a **new connection**
     (`SdDocumentService_Delivery.cs:1095-1110`; `PricingRecordsRepository.cs:382-388`). A batched
     `FillItems` exists and is unused (`PricingRepoService.cs:157-172`).
   - `CalculatePricingForDelivery` runs **twice** (`SdDocumentService_Core.cs:302, 454`). It is
     in-memory.
   - Deliveries entered **before 2025-02-27** also load the whole parent order with its own per-line
     pricing (`SdDocumentService_Core.cs:230-235, 264-283`).
3. The delivery document type description: 1 query (`SdDocumentService.cs:452-466`).
4. The status history: 1 query (`SdDocumentService_Core.cs:430-440`).
5. The returned quantities: 1 query (`SdDocumentService_Delivery.cs:117-133`).
6. The attachment stamp: 3–5 queries, with failures swallowed
   (`Modules/Sd/Services/SdDocumentAttachmentReads.cs:73-171`).

**`Document/{no}`** has the same shape. It adds billing address and diagnosis to the load, plus an
insurance stamp of 1–3 queries (`SdDocumentService.SisPricing.cs:79-102`).

**Log and Jobs are separate calls, one query each.**

- Logs: `SdDocumentLog ⟕ SdDocumentActionType` (`SdSqlStatements.cs:738-743`).
- Jobs: `SdDocumentOutbox ⟕ SdDocumentActionType` (`:746-752`).
- A delivery's jobs are keyed by its **DeliveryNo** (`003_…sql:2-3`).
- Whether either table has an unfiltered `DocumentNo` index is **unknown**.

**No caching.** The pricing context and the document service are per request
(`Logistics/LogisticsServiceCollectionExtensions.cs:25-27`).

**Observed latency: none found.**

- Prod records `DurationMs` per request in `RequestLogRecord` when `RequestLogging:IsEnabled=X`
  (`Services/SIS.Api/RequestLogger/RequestLoggingMiddleware.cs:20-67`).
- **That table is where the real number lives.** Nobody has queried it for these routes.
- There are no load tests.

**Today's client** (`oms-react/src/features/oms/document/DocumentDetailsPage.tsx:186-208`) runs the
header first, then Logs and Outbox in parallel once it renders. That is 3 HTTP calls per open.

**Against J/K at 3–5 rows/sec.** Firing the header read on every step is **not safe**: 10–12+N trips
and two pricing passes, multiplied by 3–5 per second for each operator. What a client could do:

- **Instant from the list row.** It already holds status, the four status axes, amounts, customer,
  slot, courier, note and `failedJobsCount` (`oms-react/src/core/models/delivery-document.ts:6-56`).
  No fetch is needed.
- **The header only after the selection settles.** Debounce about 150–250 ms after the last key,
  cancel stale requests (TanStack `signal` flows through to `CancellationToken`), and cache each
  row.
- **Logs and Jobs only on demand**, when their section opens.
- **A lighter summary read** would be a new BackOffice endpoint. None exists.

---

## 3. Retry: it exists, but not for the browser

**What an outbox ("Jobs") row is**

- One integration call: LastMile, Fareye, Magento, Hybris, SLNK, SMSA, OTO, SGH, refund, coupon
  reversal and others (`Modules/Sd/Outbox/Handlers/*`).
- Its fields include `AttemptCount`, `NextAttemptTime`, `RetryDeadline?` and
  `RetryIntervalMinutes?` (`Modules/Sd/Outbox/Data/SdDocumentOutbox.cs:12-25`).
- States: `P` Pending, `G` Processing, `C` Completed, `F` Failed
  (`Outbox/Constants/SdOutboxStatusConstants.cs:11-14`).
- **Only `F` is failed for good.** A `P` row with a non-empty `ErrorMessage` is "failing, will
  retry".

**(a) Automatic retry, always on.** `SdOutboxBackgroundService` runs a pass every 200 ms when
`Sd:OutboxWorker=X` (`Services/SIS.Api/BackgroundServices/Sd/SdOutboxBackgroundService.cs:55-74`).

- It claims up to 50 due `P` rows with `UPDLOCK, READPAST` and flips them to `G`
  (`SdOutboxRepository.cs:15-44`).
- A row stuck in `G` for more than 30 minutes goes back to `P` (`:61-81`).
- A failure re-queues the row as `P`. The next attempt is after `RetryIntervalMinutes`, or else
  after `min(2^attempts, 60)` minutes (`Outbox/Services/SdOutboxProcessor.cs:19-114`).
- The row becomes **`F`** when `RetryDeadline` passes, or after **5 attempts** if there is no
  deadline (`:86-92`). With the default backoff that is about 30 minutes. It also becomes `F` at
  once when no handler matches.
- **Nothing ever moves `F` back to `P` automatically.**

**(b) A manual re-run.** `POST SdOutbox/Run/{outboxId}` (`Services/SIS.Api/Endpoints/Sd/SdOutboxEndpoints.cs:25-37`).

**Who may call it: integration callers only.**

- It is **`ApiKeyEndpointFilter` only**, with no grant and no cookie session, so a browser gets 403.
- It is **not on the `SdDocumentWeb` door**.
- Neither WPF nor oms-react calls it; the WPF details screen only reads the outbox
  (`Sartawi.Retail/OMS/DocumentDetails/DocumentDetailsController.cs:162, 270`).
- BackOffice 802 lists it among the ungated integration routes
  (`.issues/802-UNGATED-ROUTES.AUDIT.md:565-567`).
- Ops use it from runbooks (`.issues/2093-sgh-orders-are-live-in-production.md:26-28`).

**What it does** (`Outbox/Services/SdOutboxManualRunner.cs`)

- It runs one row in **any** state, `C` included, and ignores the schedule.
- It writes `C` on success, or `P` with `NextAttemptTime = now` on failure.
- It never writes `F` and leaves `AttemptCount` untouched.

**Is it idempotent? No, not as a whole.** In the runner's own words, it "does not coordinate with
the background processor; running a row that the processor is concurrently working could
double-execute the handler" (`SdOutboxManualRunner.cs:27-29`).

- It takes no lock, checks no status, and re-runs completed rows.
- Duplicate safety is up to each handler:
  - `DeliveryReturnRefundHandler` latches the refund under an upgrade lock
    (`Handlers/DeliveryReturnRefundHandler.cs:26-35`).
  - About a dozen other handlers mention replay or idempotency.
  - `LastMileCreateOrderHandler` creates the order unconditionally and relies on the vendor to
    de-duplicate (`Handlers/LastMile/LastMileCreateOrderHandler.cs:11-36`).
- **Audit:** the runner writes only to `ILogger`, with the outbox id and handler and no caller
  identity. It writes no `SdDocumentLog` row (`SdOutboxManualRunner.cs:43, 63, 74, 99, 119`). Who
  re-ran a row is recorded nowhere.

**Other re-push routes** are all API-key only and none is on the web door:

- `SdDocument/SyncDelieryWithLastMile/{nos}`: direct, fire-and-forget, errors swallowed
  (`SdDocumentEndpoints.cs:386-388, 522-543`).
- `ResendOtp` and `ResendGpsLocation` (`:277-287`).
- `BillDelivery/{no}` (`:470, 492-519`).

**No BackOffice ticket** asks for a web-door Retry. None was found in `.issues/`.

---

## What this hands the dependent tickets

- **[Deliveries views and their counts](../366-deliveries-views-and-their-counts.md).**
  - Today a view's count can only honestly be **the loaded rows**, plus "may be more" when
    `rows.length === Limit`.
  - A real total is a new BackOffice read with a real cost: no `EntryTime` index, and it must keep
    the INNER joins.
  - A "Failed jobs" view can be built **on the loaded page from `failedJobsCount`**. It counts only
    within that page, not across the table.
- **[What the inspector shows for a selected delivery](../367-what-the-inspector-shows-for-a-selected-delivery.md).**
  - The row is free and instant.
  - The header read is heavy, so it can only come after a settled-selection debounce, with
    cancellation and a cache.
  - Logs and Jobs come on demand.
  - A light summary read would be a BackOffice ask.
- **[Retry job: drop it or ask BackOffice](../370-retry-job-drop-it-or-ask-backoffice.md).** The
  premise changes from "no endpoint" to **"an endpoint exists, but only for integration callers,
  and it is unsafe to expose"**. Any ask to BackOffice would cover:
  - a web-door twin with a grant;
  - a status check (`F` only? `P` with an error?);
  - a guard against the background worker;
  - a log entry naming the operator.
