---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 692
---

# 694 — A category field offers the whole workbook list, and a retired field reads as legacy

## What to build

Stories 4, 14; 3262 V2, V5; door 3296. A parameterised field such as `benefit[66].copayPct` offers the whole
`benefit-category` list from the workbook (1–80), not only the codes the census saw, and each code shows how often the
census saw it. A rule may name a category nobody has sent yet. The chosen code goes into the stored key.

A field on a CodeSystem the change log removed shows a **legacy** badge with its removal date and replacement, in the
catalog and on the condition. It can still be picked.

## Spine reach

model/api (parameter list, legacy data) · store/logic (key with a parameter) · component (parameter picker, badge) ·
i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] the key built from a field and a code, and read back into the picker — pure
- [ ] a never-seen code is offered and reads as such, not hidden — pure
- [ ] pick category 66 on a parameter field; the not-in-force reason shows its legacy date and replacement — flow

## Boundaries

Census rates are `Ltr` machine values. No client-side list of categories: the list is the door's. Doors stubbed; 711
reconciles.

## Done when

An author can write a rule for any workbook category, and sees before picking when a field is retired.

## Blocked by

692.

## Comments
