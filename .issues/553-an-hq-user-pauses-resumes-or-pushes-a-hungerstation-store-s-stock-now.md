---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3028-hungerstation-follow-up-on-oms-react-spec.md
blocked-by: 551 (live: BackOffice 3032)
---

# 553 — An HQ user pauses, resumes or pushes a HungerStation store's stock now

## What to build

On the HungerStation Stores page (551):

- **Pause / resume** the store's stock sync, each with a mandatory reason. The door returns the store row,
  so the grid updates that row in place.
- **Sync now** pushes the store's stock to HungerStation **in full**, with a mandatory reason. The
  confirmation says it is a full push to the live HungerStation vendor. The door returns the push's log row,
  which is shown as the result (rows sent, status) and refreshes the row's sync block.
  - The action is disabled on a paused store. If the server still refuses with DHS-00013, show it inline.
  - DHS-00014 (502): HungerStation refused or was unreachable. Show HungerStation's answer from `message`,
    and say that the push was recorded as failed (it appears in the logs, 554).
  - 409 `HungerStationSyncBusy`: another push of this store is running right now. Say "a push is already
    running; try again shortly". It is **not** an error state, and nothing was recorded.
  - DHS-00007 refreshes the list (the store was removed meanwhile).
- While a sync-now is in flight, the action shows progress and cannot be clicked twice.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md`, sections
`PUT …/Sync/{storeCode}/Active` and `POST …/Sync/{storeCode}/Now`.

## Spine reach

UI → app (BackOffice doors, stubbed until 557)

## Proof (→ `tdd` red-green cycles)

- [ ] helper: the sync-now result line (rows, status) and the mapping of DHS-00013, DHS-00014 and
  `HungerStationSyncBusy` to their messages (vitest)
- [ ] `tools/hungerstation-stores-drive.mjs`: new sections, against stubs, LTR and RTL:
  - pause and resume bodies with reasons, and the row updates in place;
  - sync now: success, 502 with HungerStation's message, 409 busy, disabled when paused;
  - no double submit.
- [ ] typecheck, lint, test green

## Boundaries

oms-react only. Same gate as the Stores page (`canManageStores`). On staging (557), sync now is exercised
only on a **staging-only vendor id**, so production HungerStation is never pushed.

## Done when

The helpers and the drive are green; the live check rides 557.

## Blocked by

- [551](551-an-hq-user-lists-onboards-and-edits-hungerstation-stores-with-a-reason.md)

(live: BackOffice 3032)
