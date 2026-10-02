---
type: wayfinder-ticket
wayfinder: research
map: 358
status: done
blocked-by: —
---

# 360 — What the delivery reads give us

## Question

Find the facts the list and details tickets hang on. Read the oms-react `api.ts` files, then the
SIS.Api / BackOffice sources behind them.

1. **Total count.** Does `SdDocument/DeliveryDocumentList` return a total count beyond the loaded
   rows (the result limit)? Is there a cheap count read for a set of criteria?
2. **Cost of the details read.** What does the read behind Delivery details cost per call: fields,
   items, Log, Jobs, observed latency? Could it run on every selection change while an operator
   steps through rows with J/K?
3. **Retry.** Does any endpoint retry or re-run a failed delivery job, in SIS.Api or BackOffice?
   Who may call it, and is it idempotent?

The resulting summary goes in `assets/360-delivery-reads.RESEARCH.md`, linked from this ticket.

## Answer

**Resolved 2026-10-02.** Research: [360-delivery-reads.RESEARCH.md](assets/360-delivery-reads.RESEARCH.md),
read from the BackOffice source. Dev SIS.Api was down, so there is **no observed latency**. The real
number is in prod's `RequestLogRecord` table, and nobody has queried it.

1. **Total count: none.**
   - `DeliveryDocumentList` returns a bare `TOP (@Limit)` array, with no total and no `hasMore`. The
     server default is 500 and the cap is 20,000; the client sends 200.
   - The only honest signal is `rows.length === Limit`, which means "may be more".
   - No count for a set of criteria exists. The three per-store counts use fixed predicates and are
     API-key only (403 to a browser).
   - A new `COUNT(*)` could reuse the WHERE clause, but it must keep the INNER joins. It would be
     costly, because `EntryTime` has no index.
   - Each row already carries **`failedJobsCount`**: its `F` outbox rows, from a cheap filtered-index
     seek.
2. **The details read is heavy.**
   - `Delivery/{no}` costs about 10–12 DB trips **plus one per line** (N+1 `FillItem`, one new
     connection each). The legacy pricing engine runs **twice**, and there is no cache.
   - Logs and Outbox are separate calls, one query each.
   - It is **not safe raw at J/K speed.** The list row is free and instant. The header can follow
     only after a settled-selection debounce, with cancellation and a per-row cache. Logs and Jobs
     load on demand.
   - A light summary read would be a new BackOffice ask.
3. **Retry exists, but not for the browser.**
   - The background worker retries `P` rows automatically, with backoff, until 5 attempts or a
     deadline. **`F` is terminal**, and nothing revives it.
   - `POST SdOutbox/Run/{outboxId}` re-runs any row in any state.
   - It is **API-key only and not on the web door.** It is **not idempotent**: by its own doc it can
     double-execute against the worker, it re-runs `C` rows, and duplicate safety is up to each
     handler (LastMile create has none).
   - It records **no operator** (`ILogger` only).
   - No BackOffice ticket asks for a web-door twin.

This changes the premise of [Retry job: drop it or ask BackOffice](370-retry-job-drop-it-or-ask-backoffice.md):
an endpoint now exists, but it is unsafe to expose. It unblocks
[Deliveries views and their counts](366-deliveries-views-and-their-counts.md) and
[What the inspector shows for a selected delivery](367-what-the-inspector-shows-for-a-selected-delivery.md).
