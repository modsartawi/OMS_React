---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 692, 693, 694, 695, 696, 697, 698, 699, 700, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710
---

# 711 — The FHIR insurance rules screens call the live doors and are reconciled to them as built

## What to build

**HITL.** Every ticket of this wave builds on stubs, because all its doors were open when it was filed. This one reads
the brief's "Changes" and each ticket's Comments, re-points the shape guesses to the doors as built, and walks the
screens on a live SIS.Api. New grants and menu gates are settled here.

## Spine reach

model/api (reconciled shapes) · store/logic · component (gates) · i18n · test (live drive)

## Proof (→ `tdd` red-green cycles)

- [ ] every pure test still green after the reconcile, with changed shapes covered by new cases — pure
- [ ] a live drive over catalog, raw mode, proposal and approval, monitor, review list, labels, re-pin and inspector —
      flow
- [ ] owner walk on the deployed host — app action

## Boundaries

Live doors never submit to Nphies. Patient data stays out of the repo, the screenshots and the drive logs. Communication
and payment (701) may close later, on their own census gate.

## Done when

The live drive is green, the owner has walked the screens, and the brief's Changes are all reconciled. If 701's doors are
still gated then, split it out rather than hold the wave.

## Blocked by

All of 692–710; BackOffice 3282, 3283, 3284, 3290, 3292, 3293, 3294, 3295, 3296, 3297, 3298, 3299, 3300 deployed.

## Open questions (BackOffice asks)

- **Catalog read door:** no door ticket's "What to build" names the catalog `GET`. Confirm who builds it.
- **"Nphies will refuse" on an OMS order:** `Guards/Check` returns this finding (stories 27, 34), and no brief row shows
  it on the OMS order guards. Should that panel show it? Not built in this wave.
- **Playground and simulator with FHIR facts:** the spec has both read FHIR rows, and the brief lists neither screen.
  Left out of this wave; confirm they need no client change.

## Comments
