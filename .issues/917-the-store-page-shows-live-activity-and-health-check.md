---
status: open
spec: BackOffice 4016
blocked-by: BO 4032, 916
---

# 917 — The store page's Live activity and Health check panels, and Check now

## What to build

- **Live activity**: the four result sets of `GET StoreDatabase/LiveActivity` as four tables, with a Refresh button
  (and the time of the look), so the agent can take two or three looks.
- **Health check**: findings by priority with the fix text.
- **Check now** (Act key): reason dialog, then the fresh reading replaces the panel.

## Spine reach

UI

## Proof (→ `tdd` red-green cycles)

- [ ] Check now requires a reason and is hidden without Act

## Boundaries

—

## Done when

Panels work against the dev store.

## Blocked by

BackOffice 4032, 916
