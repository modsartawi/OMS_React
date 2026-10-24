---
status: done
spec: 558
blocked-by: 561, 563
---

# 564 — A technician applies a profile to stores, with ActionSync paused first

## What to build

The New campaign dialog (561) gains **Apply** mode:

- **Reason:** required, trimmed, at least 10 characters, checked as typed.
- **What gets written:** of the selected tables, those with `applyAllowed` are listed as written and
  the rest as only reported. If none is appliable, Apply can't be chosen (the door's 422
  `DATASYNC_PROFILE_NO_APPLY_TABLES` is the backstop).
- **Store readiness** from `ActionSync/Fleet` for the picked stores (`fleet: 'all'` checks the fleet's
  pages): **WPF-hosted** → named as never appliable, with a one-click "drop them"; on the worker and
  paused and acknowledged → ready; on the worker otherwise → will be paused.
- **"Pause ActionSync first"**, on by default. The flow, per spec 558:
  1. create the campaign (Apply + reason) → Ready, with its id;
  2. pause the stores through `ActionSync/Stores/Control` (`Pause`) in batches of ≤ 50, reason
     `DataSync campaign <campaignId>: <reason>`; per-store refusals (`NOT_ON_WORKER`, `NO_STORE`)
     listed;
  3. Start. Stores not yet acknowledged wait server-side as `Queued(WaitingForPause)`.
  Turned off, the dialog warns that unpaused stores will wait until someone pauses them.
- **Create warnings** (`success: true` with per-store `DATASYNC_STORE_BUSY` /
  `DATASYNC_STORE_WPF_HOSTED`) show on the new campaign, not as a failure. Refusals: 422
  `DATASYNC_REASON_REQUIRED`, `DATASYNC_PROFILE_NO_APPLY_TABLES`, 409 `DATASYNC_STORE_BUSY` (no target
  safe), plus 561's.
- **Grants:** the pause step needs `ActionSync.Operate` (from `ActionSync/Access`, called by this
  feature's own `api.ts`). Without it the toggle is disabled and the dialog says someone who holds it
  must pause the stores.

## Spine reach

model/api · store/logic · component/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `buildCreateRequest` (Apply): reason trimmed and required ≥ 10; written vs reported tables from `applyAllowed` · pure (`apply-helpers.test.ts`: `reasonProblem`, `buildCreateRequest` Apply, `applyTableSplit`)
- [x] `applyReadiness`: each ActionSync row → never / ready / will-pause; batches of ≤ 50 with the tagged reason · pure (`applyReadiness`, `storesReadiness`, `storeControlBatches`, `campaignControlReason`, `runApplyFlow` order + failure branches; 24 tests)
- [x] `tools/data-sync-apply-drive.mjs`: with stubs, the order **pause (pending) → create → pause (tagged) → start** is exact (the ruled order, see Comments), the reason tag carries the new id, WPF stores can be dropped, warnings and refusals render, the toggle is disabled without `ActionSync.Operate` — **57/57** (561's create drive still 36/36)

## Boundaries

New endpoints: `GET ActionSync/Access`, `GET ActionSync/Fleet`, `POST ActionSync/Stores/Control`
(existing ActionSync doors; types from `core/models/sync-console`, calls written again in this
feature). DataSync codes as above.

## Done when

From stubs, an Apply campaign is created, its stores paused with the campaign's tag, and started, in
that order; the helpers and the drive are green.

## Blocked by

[561](561-a-technician-runs-a-report-only-compare-of-a-profile-against-chosen-stores.md),
[563](563-a-technician-pauses-resumes-or-cancels-a-campaign-or-one-store-s-job.md)

## Open questions

- **DataSync ask B (create before pause).** The create door refuses an Apply with 409
  `DATASYNC_STORE_BUSY` when no target is safe yet. In this flow that is always true, because the
  stores are paused only after create returns the id the tag needs. Proposed in spec 558: a
  `pauseActionSyncFirst: true` create flag that turns the all-unsafe refusal into per-store warnings.
  Decide before building: build ask B in `C:\Work\Replicate_SqlDataCompare` (recommended), or pause
  untagged first and re-pause with the tag after create.

## Comments

**2026-10-24 — built (stubbed; no live DataSync or ActionSync).** Rulings an owner may overrule:

- **Open question settled by the orchestrator's standing ruling (replaces the step order above).**
  DataSync ask B is not built and ADR 0004 §2 says the create carries no pause flag, so no
  `pauseActionSyncFirst` is sent. With "pause ActionSync first" on: (1) pause the targets
  **untagged**, reason `DataSync campaign (pending): <reason>`, batches ≤ 50; (2) create (Apply +
  reason); (3) re-pause the stores step 1 took, **tagged** `DataSync campaign <campaignId>: <reason>`,
  batches ≤ 50; (4) Start. Why: DataSync marks a job `actionSyncResumable` only when the store's
  LATEST ActionSync control audit row carries the tag. `runApplyFlow` in `apply-helpers.ts` owns the
  order; the drive asserts it exactly. If ask B ships, step 1 can go (create → tag → start).
- **Ready stores are paused too.** Both pauses take every target that is not never-appliable,
  already-paused ones included — otherwise their latest audit row is not ours and the hand-back
  (565) never sees them resumable.
- **Nothing is resumed on a failure.** A pause batch failing outright stops before the create; a
  refused create stops there. The dialog lists the stores that were paused and are still paused.
  A failed tagged re-pause or a refused Start still keeps the campaign: the outcome lists the
  untagged stores (they will not be offered for hand-back) / the Start refusal.
- **Toggle off ⇒ create only.** The campaign is created Ready and Start stays on its page (like
  report-only), with the "unpaused stores will wait" warning. With it on, the flow starts the
  campaign itself, per spec step 4.
- **Apply ends on an outcome view in the dialog** (campaign id, started or not, tagged count,
  ActionSync per-store refusals, the create's warnings) with "Open the campaign", rather than closing
  onto the page — the warnings exist only on the create's envelope. That is how "warnings show on
  the new campaign" is read; report-only still closes onto the page.
- **The whole fleet: WPF stores are named but cannot be dropped** (`fleet: 'all'` has no exclusion;
  dropping would mean sending every other code, which waits on ask A). DataSync warns on them.
- **Readiness reads the whole ActionSync fleet** (pages of 200) — the door has no exact-codes filter.
  A code ActionSync does not know is "never" (not on ActionSync), droppable with the WPF ones.
- **ActionSync access** reuses the sync console's probe key `['sync-console','access']` re-spelt
  (features can't import features) so the two share one cache entry.
- Deferred: the live walk (566) — ActionSync's real reason length limit and the ask A `client` gap.

### 2026-10-24 — review fixes (branch `review/558-fixes`; orchestrator rulings, overrule the notes above)

- **The flow now waits for ActionSync to acknowledge** before it creates (code review SERIOUS: the
  create refuses 409 `DATASYNC_STORE_BUSY` when no target is paused ∧ acknowledged, wire §7.2). Order:
  untagged pause of the stores still worked → re-read `ActionSync/Fleet` every 3 s (`ACK_POLL_MS`),
  at most 2 min (`ACK_WAIT_MS`), the button reading "Waiting for N stores to acknowledge…" → create
  if at least one target is safe, else **stop** before the create and list the stores still paused
  (nothing is ever resumed) → tagged re-pause of the stores the flow paused → Start. The decision is
  pure (`ackProgress(rows, codes)` + `ackDecision(progress, alreadySafe, timedOut)` in
  `apply-helpers.ts`); the timer is injected into `runApplyFlow` (`sleep`, `now`, `readFleet`). A
  failed fleet read is waited through, not a reason to give up. At the bound with some target safe
  the create goes ahead; the stores still waiting come back as its warnings.
- **Ready stores are no longer paused** (overrules "ready stores are paused too"): a store already
  paused and acknowledged by someone else is never paused again, untagged or tagged — never tag a
  pause that isn't ours. `StoresReadiness.toPause` = `willPause` only. Their jobs are therefore not
  `actionSyncResumable`; the dialog now says up front (`apply.readiness.readyKept`) that they keep
  that pause and stay paused afterwards for whoever paused them.
- **Create warnings reach the campaign page**: "Open the campaign" carries them in router state
  (`CampaignPageState`, read by `createWarningsFromState`) and the page shows them as a notice
  (`CreateWarnings.tsx`). DataSync keeps no copy, so they **do not survive a reload** — the notice
  takes them once and clears the history entry's state (a browser would otherwise keep it across a
  reload), and says so on screen.
- Standards: shared `RefusalBanner` (was copied in four places), `CodeWord` / `code-words.ts` for
  the "code → word, else the raw code" idiom (raw fallback in `Ltr` in JSX, `fsi` in toasts, bare in
  grid values), `apiErrorMessage` always with a `t()` fallback, the reason hint's `{{min}}` in an
  `<n>` slot, `figure` renamed `groupDigits` (core's `formatNumber` does not group), unused
  `jobs.open` key removed.
- Drive `tools/data-sync-apply-drive.mjs` 67/67 (stubbed): asserts ≥ 2 fleet re-reads between the
  last pause and the create, the ready store never paused/tagged, the warnings notice (and its absence
  after a reload), and a new §7 where ActionSync never acknowledges (clock fast-forwarded past 2 min).
