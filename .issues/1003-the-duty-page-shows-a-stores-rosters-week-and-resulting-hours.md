---
status: open
spec: BackOffice 4456
blocked-by: BackOffice 4476
---

# 1003 — The duty page shows a store's rosters, week and resulting hours, and a duty administrator writes directly

Spec: BackOffice `.issues/4456-the-store-hierarchy-and-the-duty-roster-are-kept-in-backoffice-and-fill-omss-storearea-and-storeduty-spec.md`.

## What to build

Organisation › Store duty, after `BackOffice/.issues/assets/4409-duty-screen-prototype.html`. EN/AR, RTL (the
timeline mirrors), dark mode. Screens say "opening stretch", never "shift".

- Store list grouped by patch ("yours", roster-today marks, waiting dot).
- Store page, one long scroll: Rosters table, Week (day picks with live counts, 30-hour timeline with a midnight
  line and quarter-hour dragging, "open 24 hours", "Custom…"), Resulting hours calendar coloured by roster with jumps
  to today and coming periods, a clicked day's rosters, Decision history.
- Staffing inputs with weekly open hours computed.
- Week editor live checks: overlap, close before open, fourth stretch, overnight past next opening.
- Duty administrator: direct write / end with a required note.

## Spine reach

UI (oms-react) → SIS.Api endpoints of the BackOffice tickets it is blocked by

## Proof (→ `tdd` red-green cycles)

- [ ] `WeekEditor_LiveChecks` · vitest
- [ ] `WeeklyHours_Computed` · vitest
- [ ] `ResultingHours_ColouredByRoster` · vitest
- [ ] `Rtl_TimelineMirrors` · vitest
- [ ] HITL: walked against a BackOffice host in English and Arabic, light and dark

## Boundaries

Reachable only through the `StoreDuty` view grant.

## Done when

Proof green.

## Blocked by

BackOffice 4476
