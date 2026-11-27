---
status: open
spec: 983
blocked-by: —
---

# 994: Changing the store never leaves the console stuck

Slice of [spec 983](983-the-console-is-built-around-the-caller-spec.md). Reference picture: the
*Call Center Console v3* artifact (v3).

## What to build

The owner reported that the console "gets stuck when I change the store". The walk has not
reproduced it yet. Reproduce it with both the console's store override (`StorePicker`, `store-move.ts`)
and the top-bar store switcher, on the walk set-up. Find the cause with `diagnosing-bugs` and fix it,
adding a regression test at the seam that failed.

## Spine reach

diagnose → test → fix at the failing seam

## Proof (→ `tdd` red-green cycles)

- [x] A red test reproducing the stuck state, made green by the fix
- [x] Drive: change the store mid-order both ways; the console stays usable and re-prices (stubbed; the owner's walk is still owed)

## Boundaries

If the cause is server side, file a BackOffice ticket and link it here instead of patching around it.

## Done when

The owner changes the store both ways on the walk and it does not stick.

## Comments

**2026-11-27, diagnosis (stubbed, no SIS.Api).** Loop: `tools/callcenter-store-change-drive.mjs`
(vite on 5204), four scenarios, both doors. Before the fix it went **45 passed, 2 failed**. Both
failures are the same stuck state:

- **The cause (client side).** A collection order still on the store `open` seeded
  (`plantSource: seededAtOpen`) has its item gate shut with `STORE_NOT_CHOSEN`. Contract §2.3 item 4
  (capture 10 `pickupConfirmSeededStore`, BackOffice `SetStoreAsync`) says the one way out at that
  store is `setStore` carrying the store the order already holds, which moves it to
  `chosenForPickup`. `StorePicker` disabled the current row as *on this order*, and nothing read
  `capabilities.canConfirmSeededStore`, so the agent could not choose the store the caller collects
  from. The gate stayed shut and the opening card stayed up: stuck. The top bar leads straight into
  it. Switching the acting store there and starting a new order seeds the order at the new store,
  and that store was then the one row the picker would not take (drive scenario D).
- **The fix.** `storeOption()` in `store-move.ts` returns `move | current | confirm`. The current row
  is `confirm` (choosable, and it says *opened here, not chosen yet*) exactly when the server sends
  `canConfirmSeededStore === true`. Red test: `store-move.test.ts` › `storeOption` (3 cases, red
  before the export existed, green after). Drive after the fix: **58/58**.

**Ruled out (the drive is green on each):**
- Moving the order with the console override mid-order and back (`1001 → 1204 → 1001`, previewed,
  confirmed, re-priced). No sheet, busy strip or fault is left standing, and search stays enabled.
- Moving the acting store with the top-bar switcher mid-order. Nothing in the console reads
  `currentStoreCode` or takes `useStoreLock`, so the order keeps its plant, no query reacts and the
  order is not re-opened. The override still works after it.
- Queries keyed without the plant: the session key is per transaction and the rebind writes the
  new state through `applyState`. `itemSearchKey`, `priceCheckKey` and `stockElsewhereKey` leave the
  plant out but are `staleTime: 0`, so they re-ask the next time they mount. That can make an open
  panel stale; it cannot make it stuck.
- Locks and confirms: `rebind` settles on every path (preview, commit, swallowed, stale or expired
  token re-preview, refusal), and `declineMove` / `closeStorePicker` reset it. The re-preview is
  bounded by `move.confirmToken !== undefined`.
- Server side (read only, BackOffice `CallCenterSessionService.Verbs.cs`): `RaiseAssignedElsewhere`
  refuses a basket whose acting store has moved, but only on the **Mini POS** seat
  (`ServerAssigned`). The call center seat is `AgentChoice`, so a top-bar switch does not refuse
  the web console's verbs. Nothing to file.

**Still owed:** the owner's walk. Change the store both ways on a live order, and on a new
collection order choose the store it opened at, with no SIS.Api stub. If it still sticks there,
capture the network (HAR) at the moment it sticks; the stubbed loop above cannot see a live-only
cause.
