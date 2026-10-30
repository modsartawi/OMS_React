---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: —
---

# 704 — Aliases are proposed and approved

## What to build

Story 60; D7, D11; door 3294. A screen lists aliases (payer, wrong URL → canonical URL) with their state. A grant holder
proposes one, for example TAKAFUL's misspelled UCUM URL, and someone who is not the author approves it. An alias is
applied when matching codings and UCUM units, and the screen says that the kept bundle itself is never rewritten.

## Spine reach

model/api (aliases, propose, approve) · store/logic (form rules, who may act) · component (list, form) · i18n (en + ar) ·
test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] the form refuses an empty or identical wrong and canonical URL; who may approve — pure
- [ ] propose as one user, approve as another; the pair reads correctly under `ar` — flow

## Boundaries

An approved alias reaches a published rule only through a re-pin draft (705). A URL pair is `formatPair`-style one
isolated value or words between isolated values, never two isolates glued. Doors stubbed; 711 reconciles.

## Done when

A payer's quirk can be named once and approved by a second person.

## Blocked by

None (can start immediately).

## Comments
