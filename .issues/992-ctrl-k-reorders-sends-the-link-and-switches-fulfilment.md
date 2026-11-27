---
status: open
spec: 983
blocked-by: 989
---

# 992: Ctrl K can reorder, send the location link, switch fulfilment and take the next slot

Slice of [spec 983](983-the-console-is-built-around-the-caller-spec.md). Reference picture: the
*Call Center Console v3* artifact (v3).

## What to build

New rows in `palette-model.ts` (D13):
- Reorder last order;
- Send location link;
- Switch to collect / Switch to deliver;
- Next free slot;
- Apply a held coupon.

Each is enabled exactly when its handler is handed in, and a refused row carries its reason. *Place
order* and *Abandon* stay terminal rows with no chord (153, 192, 365 §7).

## Spine reach

pure (`palette-model.ts`) · page wiring · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `newRowsAreEnabledOnlyWithAHandler` · pure
- [ ] `noChordReachesATerminalAct`: the existing guard still holds with the new rows · pure

## Boundaries

No wire change.

## Done when

Every new row works from Ctrl K on the walk.
