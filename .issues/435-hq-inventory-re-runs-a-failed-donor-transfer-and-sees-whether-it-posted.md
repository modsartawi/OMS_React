---
status: done
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

- [x] `runOutcome` — success / not finished with an error / network or timeout → "may still be running" / `NOT_RERUNNABLE` business refusal · pure
- [x] `tools/failed-donor-transfers-drive.mjs` extended — the action only on a failed line with the grant; confirm → posted → reload; did not finish; no answer; a failed reload keeps the list; no action without the grant · flow

## Boundaries

- A new write door (BO-4, 06 grant, not filed), built on a stub.
- The `success:false` code is `NOT_RERUNNABLE`.
- Re-running posts stock in DRS, so the drive must never point at a live SIS.Api.

## Done when

The drive covers all four outcomes on the stub, and the gates are green.

## Blocked by

[434](434-hq-inventory-sees-the-failed-donor-transfers-queue-with-what-each-line-asks-of-them.md)

## Comments

**Done 2026-10-08 (AFK).** This was built on a STUB of spec 430 D2/D5. The run door
`POST SdDocumentWeb/FailedDonorTransfers/{outboxId}/Run` (BO-4, not filed) is NOT built, so nothing
was driven against a live SIS.Api. Driving a live one is forbidden anyway, because the re-run posts
stock in DRS.

- **Proof:**
  - vitest `failed-donor-transfers/run-outcome.test.ts` (11 tests):
    - posted
    - did not finish, with the error trimmed, and with no error (no gap)
    - a null answer is not read as posted
    - network, a 504, a 500, an unknown status and a thrown non-`ApiError` all give "no answer"
    - `NOT_RERUNNABLE` and other business refusals carry their message
    - a refusal with no message leaves the wording to the screen
    - a 401 is left to `@/core/api`
  - Full suite: 218 files, 4021 tests green.
  - Drive `tools/failed-donor-transfers-drive.mjs`: 102/102 in LTR and RTL (stubbed; it was 66 before).
    - Re-run appears only on the failed line (not on the retrying, reverse-by-hand or unknown-status lines).
    - Without the re-run grant there is no Re-run column at all.
    - It confirms in the app's `<dialog>`, naming the request isolated. No browser dialog ever opens.
    - Cancel posts nothing.
    - Six runs: posted (POST with the line's outbox ID), did not finish with DRS's error, a dropped call and a 504 (both "may still be running", never "failed"), `NOT_RERUNNABLE` with its message, and posted followed by a failed reload. That last one keeps the list under the banner and keeps the run's toast.
    - Every run is followed by exactly one reload.
  - typecheck, lint (4 gates) and build are green.
- **Outstanding (not AFK's):** the live walk on a real SIS.Api once BO-4 ships, and the owner's eye on the Arabic rendering.
- **Review:** `/code-review` and `/standards-review` were run.
  - Fixed: column defs stay stable during a run, so a run no longer resets column widths. A double-click guard was added. A refusal with no message shows a translated "no reason" instead of a raw code. The Re-run column is wider.
  - Rulings in `.afk/HITL-435.md`: any non-business failure counts as "may still be running"; no cooldown after a lost answer; the extra modal line and the no-error wording.
