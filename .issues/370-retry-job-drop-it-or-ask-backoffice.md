---
type: wayfinder-ticket
wayfinder: grilling
map: 358
status: done
blocked-by: 360
---

# 370 — Retry job: drop it or ask BackOffice

## Question

The prototype puts a **Retry** action on a failed job. If
[What the delivery reads give us](360-what-the-delivery-reads-give-us.md) finds no endpoint, choose
one:

- **Drop it** from the redesign.
- **Show it unavailable**, with an explanation.
- **Ask BackOffice for one.** The ask must settle who may retry, idempotency and the audit trail.

**What [What the delivery reads give us](360-what-the-delivery-reads-give-us.md) found
(2026-10-02).** The premise changes: there **is** an endpoint, but only for integration callers, and
it is unsafe to expose as it stands.

- `POST SdOutbox/Run/{outboxId}` is API-key only and **not on the web door**.
- It re-runs any row in any state, `C` included.
- It can double-execute against the background worker.
- It records no operator.

The automatic worker already retries `P` rows. Only `F` rows (the ones in `failedJobsCount`) are
stuck for good. So "ask BackOffice" now means a web-door twin with a grant, an `F`-only state check,
a guard against the worker, and a log entry naming the operator. "Drop it" means failed rows stay
an ops-runbook job. Details in the
[research note](assets/360-delivery-reads.RESEARCH.md#3-retry-it-exists-but-not-for-the-browser).

## Answer

**Resolved 2026-10-02 by owner grilling. Ask BackOffice for a safe web-door twin.** We don't drop
Retry or show it unavailable. The API-key `SdOutbox/Run` stays as it is, as the ops-runbook tool.
Eight rulings:

1. **Who: a dedicated grant.** Retry gets its own `BackOfficeScreen[<controller>,03]` grant, not
   `DocumentDetails,03`, the grant that sits behind every other OMS write today (see 134). A retry
   fires a real outside call (LastMile create, Magento, a refund), so ops hand it to a few people.
   This is the **first per-command grant on the OMS door**, and the OMS access probe gains a field
   for it.
2. **Which jobs: `F` only.**
   - A `P` row with an error is still the worker's, and the UI shows it as information ("failing,
     retrying automatically") with no button.
   - `C` is never retryable.
3. **How: re-queue, don't run inline.** The door is one conditional
   `UPDATE … SET Status='P', NextAttemptTime=now WHERE OutboxId=@id AND Status='F'`, and the
   background worker does the run on its one existing path.
   - **The guard against the worker comes free:** the worker never holds an `F` row.
   - **A double click is safe:** the second update touches 0 rows and gets a business refusal
     (for example `NOT_FAILED`: "already re-queued, or no longer failed").
   - The response means "queued", not "succeeded". The page re-reads Jobs and the Log to show
     the outcome.
4. **Attempts: one shot.** `AttemptCount` and `RetryDeadline` stay as they are, so the worker's
   existing rule sends the next failure straight back to `F`.
   - The operator learns within seconds whether their fix worked.
   - A handler with no de-dup (`LastMileCreateOrderHandler`) fires once per click, not 5 times
     over about 30 minutes.
   - **BackOffice must confirm** that the processor checks the deadline and attempt count **on
     failure only**, not before it runs a claimed row (`SdOutboxProcessor.cs:86-92`). If it checks
     before the run, the door must clear the expired deadline just enough for one attempt.
5. **Audit: one `SdDocumentLog` row per retry**, written in the **same transaction** as the `F→P`
   update, on the job's delivery:
   - a new 4-letter `actionType` meaning "job retried", named by BackOffice;
   - `entryUser` = the operator;
   - `actionData` = the outbox id + handler name;
   - `note` = the operator's optional note.

   No columns are added to the outbox row. The row then shows in the Activity feed next to the
   job's own outcome.
6. **The click: a confirm, with an optional note.** The confirm names the outside system and the
   job, the attempts used and the last error. The note goes into the Log row. No reason is
   required.
7. **Scope: one job per click.** A delivery with two failed jobs shows two Retry buttons, each with
   its own handler and last error. Jobs are ordered outside calls (create before notify), so there
   is **no "retry all"** on a delivery and **no bulk retry** from the list's Failed-jobs view.
8. **Rollout: banner now, button later.**
   - The Delivery details step ships **without waiting** for BackOffice. It shows the failed-job
     banner (handler, attempts, last error) with no button.
   - Retry is a **separate, later spec ticket**, blocked on the BackOffice door.
   - When it lands, the button shows **only to holders of the retry grant**: the probe fails
     closed, per the palette's grant rule in 364. Users without the grant see the banner alone.
   - Retry is a behaviour change, so an operator lead accepts it (per 361).

**The BackOffice ask is ready to file.** It is the web-door twin above: the grant, the `F`-only
conditional re-queue, the one-shot rule, the Log row in the same transaction, and the `NOT_FAILED`
refusal. It is filed at `/to-spec`, together with the map's other BackOffice asks (the
`SdDocumentHeaderAction` milestone times from 369). Nothing has been filed yet (owner's choice).
