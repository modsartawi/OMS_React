---
status: open
spec: BackOffice 3185 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md, section "Spec 3185")
blocked-by: 647
---

# 648 — One general item's group and priority are set or cleared with a reason

## What to build

A single fix to the general master needs no file. Doors BackOffice 3192
([brief](C:\Work\DMSCO\BackOffice\.issues\assets\3157-oms-react-idf-brief.md), "Spec 3185"):

- an **Edit** action on a general items row, and **Set item** for an item not yet in the master: group, priority and a
  required reason; Save is off until all three are valid (priority a whole number of 1 or more);
- a **Clear** action asks for a reason;
- a refusal shows its message; a success refreshes the row.

## Spine reach

api · logic (form validity) · component (dialog) · i18n (EN+AR) · test + drive

## Proof (→ `tdd` red-green cycles)

- [ ] `general edit form is valid only with a group, a whole priority ≥ 1 and a reason` · pure
- [ ] drive `tools/idf-general-drive.mjs` extended — set, re-rank and clear one item; a refused group shows its message ·
  flow

## Boundaries

Endpoints stubbed. Needs the general-edit grant (`canEditGeneral`) once 654 adds the probe.

## Done when

Against stubs, one item is set, changed and cleared with a reason, proofs green.

## Blocked by

[647](647-the-masters-list-shows-general-and-its-page-lists-the-general-items.md)
