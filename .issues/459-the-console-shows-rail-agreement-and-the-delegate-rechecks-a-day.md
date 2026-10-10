---
status: open
spec: 444
blocked-by: 456
---

# 459 — The console shows rail agreement, and the delegate rechecks a day

BackOffice spec 2563 phase 2 (doors 2571, 2572). **Rail agreement** asks whether a NewPos store's
finished sales reached HQ the same way on the counter rail and the mirror rail.

## What to build

- **Fleet.**
  - A "rails disagree" tile (state `railsDisagree`).
  - An Agreement column (`agree` / `disagree` / `notJudged`) that is filterable.
- **Store, Agreement tab** (from `Store/Agreement`):
  - one row per judged day (D-1..D-7, newest first) with counts and totals on each side, and the gap
    counts;
  - clicking a day filters the paged gap list (receipt number, kind, and both totals to 3 decimals);
  - days with no NewPos receipt are absent, and the tab says so when there are none.
- **Recheck** a day (`canOperate`, `ReasonDialog`). It replaces the day row with the returned one,
  or removes it when the result is `null`. `BAD_DATE` is never reachable from the UI, because only
  listed days offer it.

## Spine reach

UI → app (BackOffice doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [ ] `agreementBadge` / `gapKindLabel`: every value gets a label and token (vitest).
- [ ] `applyRecheck(days, result)`: replaces or removes the day (vitest).
- [ ] The fleet and store drives extended: the tile filters, the column, the tab day → gaps, a
  recheck that clears a gap, the read-only view.
- [ ] Gates green.

## Boundaries

oms-react only.

## Done when

The helpers and the extended drives are green.

## Blocked by

[456](456-the-fleet-page-shows-each-store-s-mirror-lane-and-the-mirror-workers.md)
