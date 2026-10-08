---
status: done
spec: 430
blocked-by: —
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

- [x] `donorInspector` — header facts per state; transfer facts only once transferred; moments newest first; a cancelled-after-transfer request shows both Transferred and Ended · pure
- [x] `tools/donor-requests-drive.mjs` extended — select → inspector, step rows with no extra call, Open delivery lands on Details, export downloads; LTR and RTL · flow

## Boundaries

No new door. Keys go in the `donor-requests` namespace.

## Done when

The drive shows the inspector and the delivery click-through on the stub, and the gates are green.

## Blocked by

[431](431-an-hq-lead-lists-todays-donor-requests-across-stores-and-filters-them.md)

## Comments

**Done 2026-10-07 (AFK).** Built on the 431 STUB of spec 430 D2/D3 — the door
`SdDocumentWeb/DonorRequests` (BO-2) is NOT built, so nothing was driven against a live SIS.Api.
No new door.

- Proof: vitest `donor-requests/inspector.test.ts` (18) — header facts per state, transfer facts
  only once transferred (kept after a cancel-after-transfer), moments newest first, both
  Transferred and Ended on a cancel after transfer, the delivery route. Full suite 213 files /
  3931 tests green. Drive `tools/donor-requests-drive.mjs` 90/90 in LTR and RTL (stubbed): empty
  prompt → click shows the pane, ↑ steps rows with NO call, the separator resizes, Open delivery /
  double-click / Enter land on `/oms/delivery/<no>` (Details asked for it), Export downloads the
  visible list (labels as shown, identities as text, no isolate characters). typecheck, lint
  (4 gates) and build green.
- The pane's width math and resize handle graduated from Deliveries to `@/core/ui`
  (`inspector-pane.ts`, `PaneSeparator.tsx`); `tools/deliveries-list-drive.mjs` re-run 362/362.
- The pane reuses only the pure `@/core/oms` donor moments; its presentation is new
  (`DonorInspector.tsx`). Opening a delivery carries `fromListState()`, so Details' Esc comes back.
- Rulings logged in `.afk/HITL-432.md`: graduation, no remembered width / fold, the extra "by"
  and pick-time lines, the blank-STO case, three copies of the delivery route left as a follow-up.

**Outstanding (not AFK's):** a live walk against a real SIS.Api once BO-2 exists; the owner's
eye on the Arabic strings (`src/locales/ar/donor-requests.json`, `inspector.*`, `export.*`) under RTL.
