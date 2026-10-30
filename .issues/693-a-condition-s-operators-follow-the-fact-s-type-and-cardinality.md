---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 692
---

# 693 — A condition's operators follow the fact's type and cardinality

## What to build

Stories 15, 16; F8–F12. Once a FHIR fact is picked, the condition offers only what its type allows:

- **money:** compared within one currency, at 3 decimals, and the currency is part of the value entered;
- **quantity:** a value and a unit;
- **code:** system + code, with the code offered from the fact's declared system;
- **list facts:** `anyOf` / `noneOf` / `count`. A single fact offers no list operator.

The sentence view reads each of them in words, EN and AR, and the guard's `onUnknown` stays visible, because a FHIR fact
can read unknown or unparsed.

## Spine reach

model (condition shapes for the new types) · store/logic (operators per type, validation) · component (condition fields,
sentence view) · i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] operators per type and cardinality; a money value with more than 3 decimals is refused at the field — pure
- [ ] each new condition round-trips through the guard wire shape unchanged — pure
- [ ] build one condition of each type, save, reopen, read its sentence; under `ar` too — flow (Playwright drive)

## Boundaries

The client never converts a unit or a currency: that is the engine's. Money stays a string on the way through, never a
JS float. The formula box only changes if the new keys fail it today. Doors stubbed; 711 reconciles.

## Done when

No condition can be built that its fact's type cannot answer, and the sentence reads it correctly.

## Blocked by

692.

## Open questions

- The wire spelling of the money, quantity and code conditions is not in the brief. It belongs to SIS.Rules 2.0.0: read
  the engine ticket's shape if it has landed, otherwise guess and list it for 711.

## Comments
