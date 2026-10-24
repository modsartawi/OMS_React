---
status: open
spec: 558
blocked-by: 564
---

# 565 — Stores whose apply succeeded are handed back to ActionSync; the rest stay paused for a person

## What to build

On an Apply campaign's page (560), once jobs finish:

- **Hand back to ActionSync:** one action, offered to holders of `ActionSync.Operate`, pre-selecting
  exactly the jobs that `Succeeded` with `actionSyncResumable: true`. It resumes those stores through
  `ActionSync/Stores/Control` (`Resume`) in batches of ≤ 50, reason
  `DataSync campaign <campaignId>: <reason>`, and lists per-store results. It's never automatic.
- **Stays paused:** every other store of the campaign is listed with why: failed, cancelled, still
  running, or not resumable because ActionSync's control changed since the job began, or the last
  ActionSync control on the store was not this campaign's. A person checks those in the sync
  console.
- The action is available while some jobs are still running (for the ones already done) and says how
  many are still in flight.

## Spine reach

model/api · store/logic · component/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `handBackSplit`: jobs → the hand-back set and the stay-paused set with a reason each; report-only campaigns give neither · pure
- [ ] `tools/data-sync-handback-drive.mjs`: with stubs, only resumable stores are posted, in batches with the tag, per-store results render, nothing shows without `ActionSync.Operate`

## Boundaries

`POST ActionSync/Stores/Control` (`Resume`), the same door as 564. No DataSync door change: DataSync
never resumes ActionSync itself (engine spec §7.1).

## Done when

From stubs, a finished Apply campaign hands back exactly its resumable stores and lists the rest; the
helper and the drive are green.

## Blocked by

[564](564-a-technician-applies-a-profile-to-stores-with-actionsync-paused-first.md)
