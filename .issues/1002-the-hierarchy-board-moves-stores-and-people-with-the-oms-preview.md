---
status: open
spec: BackOffice 4456
blocked-by: BackOffice 4469, 4470, 4471, 4472, 4474
---

# 1002 — The hierarchy board moves stores and people, with the OMS preview, one dialog per action

Spec: BackOffice `.issues/4456-the-store-hierarchy-and-the-duty-roster-are-kept-in-backoffice-and-fill-omss-storearea-and-storeduty-spec.md`.

## What to build

The board's actions.

- Selection tray; drag one card or a selection; a drop accepted **only on a patch**.
- One dialog per action: date (default the as-of date), reason catalogue, note (required on a past date), a line
  saying in force / planned / past-dated, and the server's OMS before/after table.
- Drag a person onto a vacant or filled seat (warning when they hold a seat); make vacant naming who acts; open /
  close / rename / merge / re-parent; add / edit a person (Latin, 30 characters for English).
- Deputy cover (all or chosen stores, end required) — the only action a manager has; OPX/Pro attach; store class.
- Reverse / cancel / edit planned from the log and the Planned tab.

## Spine reach

UI (oms-react) → SIS.Api endpoints of the BackOffice tickets it is blocked by

## Proof (→ `tdd` red-green cycles)

- [ ] `DropTarget_OnlyAPatch` · vitest
- [ ] `SelectionTray_BlockMove_OneDialog` · vitest
- [ ] `Dialog_PastDateNeedsANote_LatinAnd30` · vitest
- [ ] `Dialog_ShowsTheServersPreview` · vitest
- [ ] HITL: walked against a BackOffice host in English and Arabic, light and dark

## Boundaries

—

## Done when

Proof green.

## Blocked by

BackOffice 4469, 4470, 4471, 4472, 4474
