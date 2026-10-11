---
status: open
spec: 444
blocked-by: 458, 459
---

# 460 — The mirror lane and rail agreement call the real doors on staging

BackOffice spec 2563. The live counterpart of 456–459, as 450 was for the first console.

## What to build

- **Live drive.** Extend `tools/sync-console-live-drive.mjs` to the mirror and agreement doors on
  staging (OMS-HQ SIS.Api, with `Pos:ServerSyncWorker` on there).
  - Fix any drift by **amending the contract first**
    (`C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md`), then both repos.
- **OWNER: the walk on staging.**
  - The mirror lanes of the NewPos pilot stores are not red, and any red one is explained.
  - Stopping the staging apply service turns `mirrorApply` stale within 5 minutes.
  - A seeded dead letter is retried and applies, and another is acknowledged. Both show in the audit
    feed with their reasons.
  - The first nightly agreement run's tile is triaged. Expect pre-existing gaps (BackOffice
    2552/2554 history).
  - A Recheck clears a repaired day.

## Spine reach

UI → live BackOffice doors → mirror sink

## Proof (→ `tdd` red-green cycles)

- [ ] The live drive is green against staging.
- [ ] The owner walk is recorded under `## Comments`.

## Boundaries

This needs BackOffice 2564–2572 deployed on staging with their sink scripts run.

## Done when

The live drive is green and the owner has walked it.

## Blocked by

- [458](458-the-sync-delegate-retries-and-acknowledges-mirror-dead-letters-with-a-reason.md)
- [459](459-the-console-shows-rail-agreement-and-the-delegate-rechecks-a-day.md)
- live: BackOffice 2564–2572 deployed

## Comments

**2026-10-11: the client half is done. The ticket stays open for the staging run and the owner walk.**

BackOffice 2564–2572 are built and merged (`pricing2` e11e17390). The client was checked against the
server code and the amended contract door by door: routes, query params (`stage`, `reason`,
`includeAcknowledged` as `true`/`false`, `day`), bodies, data names and enum spellings all match.
The contract was amended during the BackOffice build, and two of those amendments reached the client:

- **A recheck's `day: null` has a second meaning.** It means no NewPos receipt that day (the verdict
  is removed), OR a sink that cannot be judged: Sql/107 not run, or a rail's sales table missing.
  In the second case nothing is removed. The wire does not tell the two apart. The toast claimed
  "no NewPos receipt", so it is now a neutral `info` naming both meanings
  (`agreementTab.recheck.noVerdict`). The cache still drops the day at once, and the re-read restores
  it in the second case.
- **`auditId` is nullable** on the dead-letter and recheck answers, on a sink split from HQ. The
  model is fixed; no screen reads it.
- Comments in `api.ts`/`wire.ts` no longer say the doors are unbuilt. The fill for pre-2563 doors
  stays, for a host not yet redeployed.

`tools/sync-console-live-drive.mjs` now covers the mirror rail and rail agreement:

- every door's mirror and agreement keys;
- the mirror workers, narrowed on `rail`;
- the lane invariants:
  - off the mirror ⇒ an empty lane and no mirror state;
  - `deadLetters` ⇔ `openDeadLetters > 0`;
  - `railsDisagree` ⇔ `agreement = disagree`;
- the Mirror tab: no payload key, `canRetry` = apply stage and unacknowledged, newest first;
- the Agreement tab:
  - D-1..D-7, newest first;
  - agrees ⇔ no gap;
  - the gaps add up to the days' counts;
  - the header's verdict matches the days;
- 7 read refusals and 7 write refusals, each of which writes nothing.

`--write` adds `deadletters` (retry one dead letter and acknowledge another, both named by the
inputs; the retried row must not dead-letter again within 6 minutes) and `recheck`. The audit check
now expects `MirrorRetry`, `MirrorAcknowledge` and `AgreementRecheck` too. The write inputs stay TODO
in the repo.

**Driven against the LOCAL SIS.Api** (:5111, `pricing2` e11e17390, `.\SQLEXPRESS` POS_Server holding
the 102–107 sink tables, both workers in process), as 14419: **138/138, 5 skipped**.

- **Passed:**
  - Both mirror workers fresh (`Swept`/`Applied`).
  - 4 of 6 stores on the mirror, no red lane.
  - Last hour: 152 mirror sweeps.
  - The strip's Mirror line of 24.
  - All mirror and agreement refusals.
  - **A recheck through the UI** of P624 on 2026-10-10 (reason dialog → door → verdict drawn → audit
    row with its reason).
- **Rechecked directly first:** the agreement tables were empty (no nightly run had judged yet), so
  9 store-days were rechecked through the door. P624 disagrees on 10-10 (6 receipts on the mirror,
  5 at the counter, one missing at the counter) and agrees on 10-08 and 10-09. P001 disagrees on
  10-10. Store 1267 got `day: null` on all three days.
- **Skipped, no rows locally:** the local sink holds no dead letter (all 43 pull rows have
  `IsDeadLettered = 0`) and an empty inbox, so the dead-letter shape and the retry/acknowledge walk
  wait for staging's seeded dead letters. The two pass/script skips are 450's.
- **Drift in the drive, outside 460:** the access probe carries `canEnrol` (enrolment, BackOffice
  2558, already in the contract). The drive expected three flags; it now knows four. 🚩 The console
  model still lacks `canEnrol`, because the enrolment client is unbuilt in oms-react. It is harmless,
  but it needs a ticket when enrolment gets its web half.

**Still open (HITL):**

- the staging URL and login;
- staging inputs: a NewPos pilot store for `mirrorStoreCode`/`agreementStoreCode`, two **seeded** dead
  letters (`apply-<id>` to retry, another to acknowledge), and a repaired store-day to recheck;
- `SIS_API=https://<staging> npx vite --port 5250`, then
  `DRIVE_PORT=5250 SIS_USER=… SIS_PASS=… node tools/sync-console-live-drive.mjs --write --only fleet,store,mirror,agreement,refusals,deadletters,recheck`;
- the owner walk: pilot lanes not red; stopping the apply service turns `mirrorApply` stale within
  5 minutes; the first nightly agreement tile triaged; the retried dead letter actually APPLIED
  (no door shows that).

Reviews (self, the diff being small): no correctness or rules finding. i18n key added with its use;
the null-answer value is still isolated with `fsi`.
