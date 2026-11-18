---
status: open
spec: BackOffice 4016
blocked-by: BO 4031, 915
---

# 916 — The store page shows readings, history chart, largest tables and Not checked

## What to build

Opening a store from the tab shows the **Readings** panel from `GET StoreDatabase/Store`: plain-word latest
reading (engine, cap, used, allocated, free inside file, log size/used, recovery model, drive free, machine,
uptime, last backup), days to cap with its growth rate, a daily chart of used / allocated / log / drive free
(dataviz conventions), the 10 largest tables, and a Not checked banner with the last error. Side copies listed when
BO 4038 sends them.

## Spine reach

UI

## Proof (→ `tdd` red-green cycles)

- [ ] component test: Not checked banner shows the last error
- [ ] chart renders from a fixture history

## Boundaries

—

## Done when

The dev store's page renders against a local SIS.Api.

## Blocked by

BackOffice 4031, 915
