---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: —
---

# 709 — A coded rejection row opens a pre-filled guard draft

## What to build

Stories 49, 51; A10; door 3292. On the rejection report (Metrics), a row with a payer reason code offers **open as guard
draft**. It opens the guard editor with the payer, the item kind and the code in `codes.nphies` filled in, and the usual
back-test and approval follow. A row with no code does not offer it.

## Spine reach

model (coded row) · store/logic (row to draft) · component (row action, editor seed) · i18n (en + ar) ·
test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] row to draft: payer, item kind and code; a codeless row offers nothing — pure
- [ ] open a draft from a row, see it filled, save it; nothing is saved until the author does — flow

## Boundaries

Follow how templates and "Open in playground" seed an editor, rather than a new route shape. No new approval path. Doors
stubbed; 711 reconciles.

## Done when

A pattern of rejections becomes a guard draft in a few clicks, through the usual gates.

## Blocked by

None (can start immediately).

## Comments
