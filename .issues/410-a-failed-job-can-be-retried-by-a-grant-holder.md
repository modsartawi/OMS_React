---
status: open
spec: 380
blocked-by: 404
---

# 410 — A failed job can be retried, one at a time, by a holder of the retry grant

> ⛔ **NOT for the AFK loop — waiting on BackOffice.** This ticket needs spec 380's **BO-1**
> (the web-door retry), which has **not been filed** in BackOffice's tracker yet. Do not start it
> until that door exists and records its `## Web contract`.

## What to build

On Delivery details, each failed-job banner (403) gains **one Retry button**, shown only to holders
of the retry grant (spec 380 Further Notes "Retry job", **BO-1**; ruled in
[370](370-retry-job-drop-it-or-ask-backoffice.md)).

- **Scope:** one button per `F` job, in the room the banner kept at its inline end. **No "retry
  all"** on a delivery and **no bulk retry** from the list. A `P` row never gets a button.
- **The click opens a confirm** naming:
  - the outside system (the handler);
  - the job;
  - the attempts used;
  - the last error.

  It takes an **optional note**, and no reason is required.
- **On confirm,** the web posts the retry and treats the response as **"queued", not "succeeded"**.
  It then re-reads Jobs and the Log, so the spine shows the new Log row ("job retried" by the
  operator) and the job's next outcome.
- **A refusal** shows **inside the confirm** (F18), keyed off the server's code (`apiErrorCode`).
  `NOT_FAILED` reads "already re-queued, or no longer failed".
- **The grant:**
  - The OMS access probe gains the retry-grant field.
  - The button **fails closed**: it is hidden while the probe is pending or has errored, and for
    users without the grant.
  - Users without the grant see the banner alone.

## Spine reach

model (job retry request/response, probe field) · api (`document` api over `@/core/api`) · logic
(button visibility, refusal mapping) · component (Retry button + confirm with note) · i18n
(`document`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `retry button shows only for an F job and only with the grant; pending or errored probe hides it` · pure
- [ ] `NOT_FAILED maps to the re-queued wording; any other business code shows its server message` · pure
- [ ] `tools/document-retry-drive.mjs`: light, dark and RTL against a stub of **exactly** BO-1's recorded response; the confirm names the job; a stubbed success re-reads and shows the Log row; a stubbed `NOT_FAILED` shows inside the confirm; no button without the grant · flow (Playwright)

## Boundaries

- **New endpoint (BO-1):** a web-door twin of `SdOutbox/Run`.
  - **Its own grant:** `BackOfficeScreen[<controller>,03]`, the first per-command grant on the OMS
    door.
  - **A conditional re-queue:** `UPDATE … SET Status='P', NextAttemptTime=now WHERE OutboxId=@id AND
    Status='F'`, so the worker runs it.
  - **One shot:** the attempt count and deadline are unchanged.
  - **One `SdDocumentLog` row** in the same transaction: a new 4-letter action type, `entryUser` =
    the operator, `actionData` = the outbox id + handler, `note`.
  - **Envelope:** `success:false` with **`NOT_FAILED`** (a business refusal; a double click gets
    it). 401 belongs to `handle401`.

  Build against the shape BO-1's ticket records, and never invent a field.
- **i18n (`document`):** `jobs.retry`, `jobs.retryConfirm.*` (title, body naming handler, attempts and
  last error, note label), `jobs.retryRefused.notFailed`, and the "job retried" action label.
- 🚩 **Behaviour change:** an operator lead accepts it (R2).

## Done when

A grant holder retries one failed job from its banner through a confirm, the page shows the queued
re-run in the spine, `NOT_FAILED` is said in words inside the confirm, and the drive is green
against BO-1's real shape.

## Blocked by

- [404](404-facts-items-and-folded-conditions-sit-beside-the-spine.md) — the Details page with its
  job banners (403)
- **BackOffice BO-1:** the web-door retry (not yet filed)

## Open questions

- **BackOffice ticket number once filed** (BO-1), and its `## Web contract`.
- **BackOffice must confirm** whether `SdOutboxProcessor` checks the deadline and attempt count
  before it runs a claimed row or only on failure (`SdOutboxProcessor.cs:86-92`). If before, the door
  must clear the expired deadline just enough for one attempt.
