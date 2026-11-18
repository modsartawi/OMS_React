---
status: open
spec: BackOffice 4016
blocked-by: BO 4030
---

# 915 — The Store database tab lists the fleet by state, with the needs-2019 ranking

## What to build

BackOffice spec 4016 D10. A new **Store database** tab in the sync console, shown when `GET Auth/Permissions`
holds `StoreDatabase.View`'s screen key (914's single answer, no Access probe). It lists `GET StoreDatabase/Fleet`:
store, engine (2008 / 2008 R2 / 2019 / other), edition, bitness, used / cap with a bar, used share, drive free,
state chip (OK / Watch / Critical / Disk low / Not checked), taken at. Sorted worst state first, then fewest days to
cap (once BO 4031 sends it). Filters: state, engine, edition. A "Needs 2019" view: stores on a 4 GB cap ranked by
days to cap. Arabic beside English labels where the console does.

## Spine reach

UI

## Proof (→ `tdd` red-green cycles)

- [ ] component test: rows render state chips and the bar from a fixture answer
- [ ] the tab is hidden without the View key

## Boundaries

—

## Done when

The tab shows the dev fleet answer against a local SIS.Api.

## Blocked by

BackOffice 4030
