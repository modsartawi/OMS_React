---
status: done
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

- [x] `handBackSplit`: jobs → the hand-back set and the stay-paused set with a reason each; report-only campaigns give neither · pure
- [x] `tools/data-sync-handback-drive.mjs`: with stubs, only resumable stores are posted, in batches with the tag, per-store results render, nothing shows without `ActionSync.Operate`

## Boundaries

`POST ActionSync/Stores/Control` (`Resume`), the same door as 564. No DataSync door change: DataSync
never resumes ActionSync itself (engine spec §7.1).

## Done when

From stubs, a finished Apply campaign hands back exactly its resumable stores and lists the rest; the
helper and the drive are green.

## Blocked by

[564](564-a-technician-applies-a-profile-to-stores-with-actionsync-paused-first.md)

## Comments

Built 2026-10-24 (stubbed; the live walk is 566's). `handback-helpers.ts` (`handBackSplit`,
`handBackBatches`, `allCampaignJobs`) pinned by `handback-helpers.test.ts` (9); `HandBack.tsx`
(default `HandBackButton`) joins the `headerActions` fragment in `CampaignPage.tsx`; i18n `handBack.*`.
Drive `tools/data-sync-handback-drive.mjs` 30/30 against stubs (125 jobs over 3 pages, 55 resumable → 50 + 5).

- **All jobs, not the page shown.** Opening the dialog pages through `campaignJobs` (50 a page, until
  a short or empty page; capped at 200 pages = 10,000 stores) so both sets cover the whole campaign.
  Read fresh on each open (`staleTime: 0`, `gcTime: 0`) under `campaignKey(id)`, so a control's
  invalidation re-reads it too; the selection is kept as the un-ticked stores, so a re-read that finds
  more resumable stores ticks them.
- **Overrulable:** the button shows on an Apply campaign once it has left `Ready` (also when Cancelled
  — its stores are still paused and the stay-paused list is the point), gated on `ActionSync.Operate`
  only (not `DataSync.Operate`; the ticket names only the former). Pre-selected stores can be
  un-ticked; stay-paused ones can never be ticked.
- **`notResumable` is one reason, not two.** A job carries only `actionSyncResumable`, so "control
  changed since the job began" and "the last control was not this campaign's" read as one sentence
  naming both. Telling them apart needs a DataSync field (not asked).
- The Resume reason is the campaign's own `reason` in the 564 tag (`DataSync campaign <id>: <reason>`);
  no new reason is typed. A batch failing outright stops the run and lists the unsent stores; a bare
  403 says ActionSync Operate is needed but does not drop the cached ActionSync grant.
- Not checked: whether DataSync flips `actionSyncResumable` back to false after our Resume (the
  control version changes) — if it does not, re-opening offers the same stores again (a harmless
  second Resume). The live walk (566) should look.

### 2026-10-24 — review fixes (branch `review/558-fixes`; orchestrator rulings)

- **Hand back now needs BOTH `DataSync.Operate` and `ActionSync.Operate`** (spec 558: every action
  needs DataSync.Operate; story 34). `HandBackButton` reads `useCanOperateDataSync()` beside the
  ActionSync grant; absent, not disabled, without either. Drive §7 adds a DataSync viewer holding
  ActionSync.Operate: no button.
- Since 564 no longer pauses stores that were already paused and acknowledged, their jobs come back
  `actionSyncResumable: false` and are listed here as staying paused; `handBack.why.notResumable` now
  names that case first ("it was already paused before the campaign, …"). They stay paused for
  whoever paused them.
- `apiErrorMessage(run.error, '')` → `t('handBack.stoppedHint')` fallback (api-envelope rule).
- Drive `tools/data-sync-handback-drive.mjs` 32/32 (stubbed).
