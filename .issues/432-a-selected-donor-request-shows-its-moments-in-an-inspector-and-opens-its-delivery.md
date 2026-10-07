---
status: open
spec: 430
blocked-by: 431
---

# 432 — A selected donor request shows its moments in an inspector and opens its delivery

## What to build

- **Inspector (spec 430 D9).** Selecting a row in the Donor requests list opens a resizable,
  read-only inspector beside the grid. It shows:
  - the header facts: request, delivery, both stores, state/outcome + reason, units, and the
    transfer STO and SAP document no once transferred
  - the request's **donor moments**, newest first, from `@/core/oms` `donorMoments`
  - an "Open delivery" action

  The inspector draws from the row alone and never fetches, so stepping through rows is free. Its
  presentation is new: the delivery timeline's components belong to the `document` feature and are
  not imported.
- **Open the delivery (D10)** from the inspector and on row double-click / Enter. It goes to
  Document Details' delivery route.
- **Export** the visible list to xlsx through the core writer.

## Spine reach

logic (row → inspector model) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `donorInspector` — header facts per state; transfer facts only once transferred; moments newest first; a cancelled-after-transfer request shows both Transferred and Ended · pure
- [ ] `tools/donor-requests-drive.mjs` extended — select → inspector, step rows with no extra call, Open delivery lands on Details, export downloads; LTR and RTL · flow

## Boundaries

No new door. Keys go in the `donor-requests` namespace.

## Done when

The drive shows the inspector and the delivery click-through on the stub, and the gates are green.

## Blocked by

[431](431-an-hq-lead-lists-todays-donor-requests-across-stores-and-filters-them.md)
