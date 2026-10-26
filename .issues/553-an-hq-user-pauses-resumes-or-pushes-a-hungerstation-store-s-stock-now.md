---
status: done
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

- [x] helper: the sync-now result line (rows, status) and the mapping of DHS-00013, DHS-00014 and
  `HungerStationSyncBusy` to their messages (vitest)
- [x] `tools/hungerstation-stores-drive.mjs`: new sections, against stubs, LTR and RTL:
  - pause and resume bodies with reasons, and the row updates in place;
  - sync now: success, 502 with HungerStation's message, 409 busy, disabled when paused;
  - no double submit.
- [x] typecheck, lint, test green

## Boundaries

oms-react only. Same gate as the Stores page (`canManageStores`). On staging (557), sync now is exercised
only on a **staging-only vendor id**, so production HungerStation is never pushed.

## Done when

The helpers and the drive are green; the live check rides 557.

## Blocked by

- [551](551-an-hq-user-lists-onboards-and-edits-hungerstation-stores-with-a-reason.md)

(live: BackOffice 3032)

## Comments

**Done 2026-10-24** (branch `ticket/553`). Proof: vitest `features/hungerstation/stores/sync.test.ts`
(the two door paths; the result line — rows grouped, `S`/`E`; DHS-00013 / DHS-00014 /
`HungerStationSyncBusy` / DHS-00007 mapped to their sentences in en + ar; the confirmation's "full push" to
the "live HungerStation vendor"; `applyPush` and `replaceRow`), typecheck + lint (4 gates) + `npm test`
(6130) green, and `tools/hungerstation-stores-drive.mjs` **216/216 against STUBS** (552's 124 plus
sections 12–14, LTR and RTL). 🚩 Not driven against a live SIS.Api — the live check is 557, on a
staging-only vendor id.

What landed:
- `stores/sync.ts` (pure): `syncActivePath`, `syncNowPath`, `syncNowResult`, `syncNowRefusal` +
  `SYNC_NOW_CODES`, `applyPush`, `replaceRow`. `storesApi.setActive` / `storesApi.syncNow` call the doors;
  `syncNowKey(store)` is the sync-now mutation key.
- `SyncActiveDialog` and `SyncNowDialog` in `StoreDialogs.tsx`; the actions cell's `act` gains
  `onToggleSync` and `onSyncNow` (type `StoreActions`). The page shows the push's result in a strip above
  the grid (`PushResult`).
- The drive's stubs keep the Active flag and the push's sync block in each context's store copy; a sync
  now whose reason is `slow push` is held until the drive releases it.

Judgement calls (overrulable):
1. **Pause / resume patch in place, no refetch.** The returned row replaces the old one in every cached
  list. So under a `sync=active` filter, a store you just paused stays on screen (reading Paused) until
  the next read. That is the "updates in place" the ticket asks for.
2. **Sync now patches, then refetches.** The log row goes straight into the row's sync block
  (`applyPush`: a full push sets the last full run and the last run, plus status and error; health is
  failing on `E`, else ok), and then the list is read again so the server has the last word.
3. **The result is a dismissible strip above the grid**, not a toast. A toast is a string-only sink, so
  it could not isolate the row count. The toast only says the push is recorded.
4. **Busy is a neutral `role="status"` panel**, not danger-styled, and the list is not re-read. DHS-00014
  re-reads the list, because the failed push is recorded; Push now stays on so the user can retry.
  DHS-00013 and DHS-00007 re-read the list and turn Push now off.
5. **No double submit is a ref guard in `SyncNowDialog`.** The first drive run caught a double click
  sending TWO pushes: both clicks land before React re-renders the confirm as busy. The shared
  `core/reason/ReasonDialog` has the same window for every write. I fixed it here only, so the core
  dialog's other users are untouched. Moving the guard into the core dialog is a candidate hardening item.
6. **Sync now on a paused store is `aria-disabled` (still focusable) with a title saying why**, per the
  Button note. The cell's button also shows progress (`Pushing…`) while the store's mutation is in flight.

Open for the owner: whether the double-submit guard should move into the shared core ReasonDialog (5).
The Arabic copy is unread by a native eye.

### Review fixes (branch ticket/3028-review, 2026-10-24)

- Spec story 19: the pause confirmation now also says pausing does NOT take the store offline on HungerStation (en + ar `pause.note`). The stores drive asserts it, LTR and RTL.
- In `SyncActiveDialog`, `active`/`ns` are renamed to `nextActive`/`verb`.
- Comment 5's open item is done: the double-submit guard now lives in the shared core `ReasonDialog`, and the local ref in `SyncNowDialog` is removed. The drive's "a double click sends ONE push" still passes.
