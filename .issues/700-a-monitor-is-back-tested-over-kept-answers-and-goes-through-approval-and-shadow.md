---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 699
---

# 700 — A monitor is back-tested over kept answers and goes through approval and shadow

## What to build

Story 38; A1, A13; door 3290. A monitor follows the guard's path: a back-test of the current revision, then ask for
approval by someone else, then shadow, then promote. Its back-test replays kept answer copies and reads as "how many
review items this would have raised, and on which answers", not as refusals on sales.

## Spine reach

model/api (monitor back-test reply) · store/logic (result reading per kind) · component (back-test tab, approvals) ·
i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] the back-test result reads per kind, and a guard's reading is unchanged — pure
- [ ] back-test, ask, approve as another user, shadow, promote a monitor — flow

## Boundaries

Reuses the approval and shadow rules as they are. Patient keys stay masked on the back-test view. Doors stubbed; 711
reconciles.

## Done when

A monitor reaches live only as a guard does, and the author saw what it would have raised first.

## Blocked by

699.

## Comments
