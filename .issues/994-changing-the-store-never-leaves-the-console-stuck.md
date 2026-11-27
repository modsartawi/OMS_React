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

- [ ] A red test reproducing the stuck state, made green by the fix
- [ ] Drive: change the store mid-order both ways; the console stays usable and re-prices

## Boundaries

If the cause is server side, file a BackOffice ticket and link it here instead of patching around it.

## Done when

The owner changes the store both ways on the walk and it does not stick.
