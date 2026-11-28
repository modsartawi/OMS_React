---
status: open
spec: BackOffice 4456
blocked-by: BackOffice 4477, 4480
---

# 1005 — The duty administrator keeps the calendar and the chain from the Calendar and Administration tabs

Spec: BackOffice `.issues/4456-the-store-hierarchy-and-the-duty-roster-are-kept-in-backoffice-and-fill-omss-storearea-and-storeduty-spec.md`.

## What to build

- Calendar tab: year strip of periods (dashed where only the computed date exists), a table per country approved /
  waiting / not yet; type period dates with the computed hint; "Set dates", "Move dates"; period kinds per country
  with "every store must confirm".
- Administration tab (duty administrator only): chain settings per roster kind as a list of levels; steps stuck at
  the top; normal proposals waiting a week or more.

## Spine reach

UI (oms-react) → SIS.Api endpoints of the BackOffice tickets it is blocked by

## Proof (→ `tdd` red-green cycles)

- [ ] `YearStrip_DashedWhenOnlyComputed` · vitest
- [ ] `AdministrationTab_DutyAdminOnly` · vitest
- [ ] `ChainSettings_EditLevelsPerKind` · vitest
- [ ] HITL: walked against a BackOffice host in English and Arabic, light and dark

## Boundaries

—

## Done when

Proof green.

## Blocked by

BackOffice 4477, 4480
