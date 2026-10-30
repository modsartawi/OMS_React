---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 692, 702
---

# 703 — Drift items are cleared with a note and badge what they affect

## What to build

Stories 58, 59, 62; D3–D6, D10; door 3293. A **drift** item on the review list shows the payer, the signal (a new profile
version, a URL never seen, a falling answer rate) and a sample's (source, id). The catalog fields and published rules it
affects carry a drift badge that links back to it, and the rules are shown as still running. A grant holder clears it
with a note and no second approver.

## Spine reach

model/api (drift item, badge data) · store/logic (signal reading) · component (row, badges on catalog and rule list) ·
i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] each signal reads in words, and rates and URLs stay machine values — pure
- [ ] a drift item shows, its badges appear on a field and a rule, clearing it removes them — flow

## Boundaries

Re-alerting is the door's. A sample is a reference, never a fragment of the bundle. Doors stubbed; 711 reconciles.

## Done when

The team sees what to re-check after a payer changes, and nothing has stopped running.

## Blocked by

692, 702.

## Comments
