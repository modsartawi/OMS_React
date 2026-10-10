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
