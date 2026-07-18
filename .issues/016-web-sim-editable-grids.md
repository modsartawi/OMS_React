---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\503-web-pos-simulation-spec.md
blocked-by: 013
---

# 016 — Editable items + manual-conditions grids

> Moved from BackOffice `.issues/513`. Renumbered into oms-react's tracker.

## What to build

Full input-grid parity with the WPF, upgrading [013](013-web-sim-screen-tracer.md)'s basic items entry.

- **Items grid** — inline-editable cells (material, quantity, UoM, condition control) with **add row**
  and **delete row**; the new-item affordance mirrors the WPF's top new-item row.
- **Manual Conditions grid** — editable (item number, condition type, rate, rate unit) with add/delete.
  Item numbers reference the server's `(position)*10` scheme, or 0 for a header/group condition (the
  engine auto-coerces header-only condition types to 0).
- Both grids feed the `SimulateRequest` on Process (items in order → server re-sequences; manual
  conditions passed through).

## Spine reach

app/UI (React) — ag-grid Community editing over the `SimulateRequest` state.

## Proof (→ `tdd` red-green cycles)

- [ ] Owner smoke: adding/editing/deleting rows in both grids and pressing Process sends the intended
      basket + manual conditions; a manual condition addressed to item 10 lands on the first line; a
      header condition (item 0) attaches at the header.

## Boundaries

oms-react repo. No BackOffice change, no bump, no flag. ag-grid **Community** editing (no enterprise
new-row/pinned-row features — an explicit Add button manipulating row state).

## Done when

Both grids support add/edit/delete and drive the simulation request correctly.

## Blocked by

[013](013-web-sim-screen-tracer.md)
