---
status: open
spec: 430
blocked-by: 434
---

# 435 — HQ inventory re-runs a failed donor transfer and sees whether it posted

## What to build

This is the **re-run** (spec 430 D5, D12, D17).

- **Where it appears.** A Re-run action is drawn only on a line whose `canReRun` is true: a FAILED
  job with an outbox ID, not reverse-by-hand, and the session holds `canReRunFailedTransfer`. Without
  the grant there is no action at all.
- **Confirmation.** It asks in the app's modal (never a browser dialog), naming the request.
- **The call** is `POST SdDocumentWeb/FailedDonorTransfers/{outboxId}/Run`, answering
  `{ success, error }`. The outcome is a toast, with the request no isolated:
  - success: "The donor transfer of request {no} posted."
  - not finished: "… did not finish: {error}"
- **Network failure or timeout** gives "it may still be running; reload in a minute". It never
  says "failed".
- **`NOT_RERUNNABLE`** is shown with its message.
- **The list always reloads afterwards**, whatever the answer. A failed reload keeps the last good
  list and never replaces the run's own toast.

## Spine reach

api · logic (run outcome → message) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `runOutcome` — success / not finished with an error / network or timeout → "may still be running" / `NOT_RERUNNABLE` business refusal · pure
- [ ] `tools/failed-donor-transfers-drive.mjs` extended — the action only on a failed line with the grant; confirm → posted → reload; did not finish; no answer; a failed reload keeps the list; no action without the grant · flow

## Boundaries

- A new write door (BO-4, 06 grant, not filed), built on a stub.
- The `success:false` code is `NOT_RERUNNABLE`.
- Re-running posts stock in DRS, so the drive must never point at a live SIS.Api.

## Done when

The drive covers all four outcomes on the stub, and the gates are green.

## Blocked by

[434](434-hq-inventory-sees-the-failed-donor-transfers-queue-with-what-each-line-asks-of-them.md)
