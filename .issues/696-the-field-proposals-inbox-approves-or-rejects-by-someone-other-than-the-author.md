---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 695
---

# 696 — The field proposals inbox approves or rejects, by someone other than the author

## What to build

Story 21; 3262 V6; door 3282. A list of proposed FHIR fields. Opening one shows its path, its Probe result per payer,
its labels and any Patient warning. A grant holder who is not the author approves or rejects it. An approved field joins
the catalog and the picker at once. The author sees why approval is not offered on their own proposal.

Reuse the role split of `core/insurance-rules/approval` where it fits.

## Spine reach

model/api (proposals, approve, reject) · store/logic (who may act) · component (inbox, detail) · i18n (en + ar) ·
test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] who may act: author, other grant holder, reader — pure
- [ ] a server refusal of an own approval shows the door's message and code, not "unexpected" — flow
- [ ] propose as one user, approve as another, find the field in the picker; reject another with its reason — flow

## Boundaries

The client hides the action, and the door still decides. Patient warning text is a locale key with `{{path}}` isolated
by `fsi`. Doors stubbed; 711 reconciles.

## Done when

No single person adds a field, and an approved field can be picked without a reload.

## Blocked by

695.

## Comments
