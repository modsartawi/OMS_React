---
status: open
spec: 444
blocked-by: 448, 449
---

# 450 — The sync console calls the real doors on staging

## What to build

Swap the stubs for the live doors and walk the console once:

- Run every drive in this spec against the staging SIS.Api (OMS-HQ), and fix any drift from the
  contract by **amending the contract first**, then both repos.
- **OWNER: the walk on staging**, with the worker running and zero to a few test stores flagged:
  - the fleet tiles add up;
  - one store moved to the worker shows "pending" and then applied;
  - a connection test returns;
  - a re-push preview counts match `ActionSync/Commands/RePush` (`preview: true`);
  - a test store is onboarded through both steps;
  - the audit feed shows every action with its reason.

The wire shapes come from the door contract, `C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md`. The layout comes from the
[prototype](https://claude.ai/artifact/557hsB6V9zt9zV1XVrZPVd).

## Spine reach

UI → app (live doors)

## Proof (→ `tdd` red-green cycles)

- [ ] Every `tools/sync-console-*-drive.mjs` passes against staging (no stubs).
- [ ] **OWNER:** the staging walk above.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green. (2026-10-10: 252 files / 4483 tests; the build is green too.)

## Boundaries

oms-react only. Deploy after the SIS.Api that carries BackOffice 2539–2542, with the `ActionSync.Health.View`, `ActionSync.Operate` and `Store.Onboard` grants seeded on OMS-HQ. The BackOffice side (BackOffice 2539–2542 deployed + grants seeded) is built in parallel; until it lands, prove the screen
against stubs of the contract.

## Done when

The drives are green live, and the owner has done the walk.

## Blocked by

[448](448-the-sync-delegate-retries-tests-and-re-pushes-stores-and-cancels-commands.md), [449](449-the-sync-delegate-onboards-a-store-and-finishes-pending-ones.md)

## Comments

**2026-10-10: the client half is done. The ticket stays open for the staging run and the owner walk.**

BackOffice 2539–2542 are built (`pricing2` 0c50ba7f6). The client was checked against the server
and the contract door by door. Routes, query params (`batch`, repeated `state`), bodies, data names
and enum spellings all match. The drifts and their fixes:

- **Re-push objects.** The picker could send two or more `objectIds`, and the door refuses that
  with a 400 `BAD_REQUEST`. The picker is now single-choice, and the commands drive checks it.
- **Edit location.** It refused a blank instance, which the contract says is the default instance.
  A blank instance is now accepted.
- **Failure labels.** The per-row `BAD_FIELD` and `FAILED` codes had no words. Both now have labels.
- **Nullable times.** Script `createdAt` and a pass's `startOn`/`finishOn` are nullable on the
  wire. **The contract was amended first** (BackOffice asset 2523). The same amendment records
  that `errors` and `data` can be null in the envelope, the pass `status` subset, and Onboard's
  `CreateLocation` audit row.
- **🚩 OWNER RULING OPEN: a holder of `canOnboard` without `canOperate`.** The master wizard always
  sends `alsoCreateLocation`, so that holder got a bare 403 every time. This was 449's sign-off
  item. Interim fix: such a holder gets no wizard, only the view-only note; `wizardStart` gives
  every wizard to `canOperate` holders only. The alternative is a step-1-only wizard
  (`alsoCreateLocation: false`), with an Operate holder finishing from Sync pending. That is legal
  under the contract, but it is new UI. The owner picks.

`tools/sync-console-live-drive.mjs` (inputs in `tools/sync-console-live-inputs.json`) is the
stubbed drives' live twin:

- It stubs nothing and signs in for real.
- It checks every door's keys and the refusal codes, and that the tiles add up.
- With `--write` it runs the walk's writes, on TEST stores only.
- A re-push is only ever previewed, never confirmed.

The write and re-push inputs stay TODO in the repo on purpose.

**🚩 Proof wording, owner sign-off wanted.** The first Proof line says every
`sync-console-*-drive.mjs` passes against staging. The five stubbed drives pin fixture values that
no real fleet holds, so they **stay as the regression** (321 checks, all green). The live drive
stands in for them on staging. This is the same call as 455.

**Driven against the LOCAL SIS.Api** (:5111, `pricing2`, `.\SQLEXPRESS` POS_Server, worker in
process), as 14419:

- **Passed:**
  - access, the fleet (5 stores, all WPF; the tiles add up), the feeds and the refusals: 41/41;
  - Move to worker → pending → applied → Hand back on P134;
  - a connection test that returned OK;
  - the audit feed, which shows all three actions with their reason;
  - the re-push preview on P134 while it was on the worker: 12/12, with the count and the echoed
    date matching the door. P134 was handed back afterwards.
- **Not proven locally:**
  - `Store/Passes` and `Store/Scripts` answer 500. The local POS_Server lacks
    `ActionProcess.JobID`/`ActionsCount` and the `DistributionLocationScript` table, while HQ's
    entities map all of them. That is a stale local schema, not a door drift. The pass and script
    shape checks wait on staging.
  - Onboarding through both steps was not run locally, because it leaves Store, payment type and
    machine rows behind. It waits on staging, with a test code.

**Still open (HITL):**

- the staging URL and login;
- real inputs: a test store on WPF, a worker store for the preview, an onboard test code;
- `DRIVE_PORT=… SIS_API=https://<staging> node tools/sync-console-live-drive.mjs --write`;
- the owner walk;
- the two rulings above.

Reviews:

- **`/code-review`:**
  - Fixed: the committed write inputs named real codes (now TODO); the `FAILED` wording; the
    refusal-case TODO guard; the re-push sum when a row has no `actions`.
  - Left as cosmetic or not borne out by the contract: the single object kept in an array, the
    process id shown when there is no start time, `EditStore` on `canOnboard` (the contract gates
    `Store/Edit` on `Store.Onboard` alone).
- **`/standards-review`:** no hard violation. The always-true `canOperate` prop was dropped. The
  spec axis raised the owner ruling and the Proof wording above. The live drive's pending badge is
  now a note, not a failure, because the worker can apply a control before the header refetches.

