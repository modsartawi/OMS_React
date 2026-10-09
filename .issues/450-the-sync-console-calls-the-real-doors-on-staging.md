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
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only. Deploy after the SIS.Api that carries BackOffice 2539–2542, with the `ActionSync.Health.View`, `ActionSync.Operate` and `Store.Onboard` grants seeded on OMS-HQ. The BackOffice side (BackOffice 2539–2542 deployed + grants seeded) is built in parallel; until it lands, prove the screen
against stubs of the contract.

## Done when

The drives are green live, and the owner has done the walk.

## Blocked by

[448](448-the-sync-delegate-retries-tests-and-re-pushes-stores-and-cancels-commands.md), [449](449-the-sync-delegate-onboards-a-store-and-finishes-pending-ones.md)
