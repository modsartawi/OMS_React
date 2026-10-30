---
status: done
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

- [x] the key built from a field and a code, and read back into the picker — pure
- [x] a never-seen code is offered and reads as such, not hidden — pure
- [x] pick category 66 on a parameter field; the not-in-force reason shows its legacy date and replacement — flow

## Boundaries

Census rates are `Ltr` machine values. No client-side list of categories: the list is the door's. Doors stubbed; 711
reconciles.

## Done when

An author can write a rule for any workbook category, and sees before picking when a field is retired.

## Blocked by

692.

## Comments

**2026-10-30, built, all stubbed (no live SIS.Api).** Drive 48/48 LTR + RTL; the 692 drive's parameter check moved with it.

Shape guesses for 711:
- `GET InsuranceRules/Fields/Catalog/Parameters/{parameter}` answers the list, a door of its own, read when a field's
  Pick is pressed. 3296 spells no path.
- Row: `{ code, label: { en, ar }, census }`, in the door's order. `census` is how many payers sent the code (the
  prototype's "28 payers"), 0 when nobody has. 3296 says "census rate" without a unit, so the count may become a share.
- `legacy.replacement` is drawn as the door sends it, a catalog key after its scope. Labels and counts in the stub are
  invented, and codes other than 66, 57, 13 and 25 are all unseen.

Overrulable decisions:
- The list is a native `Select`, as in the prototype, so its options carry the count through `fsi`. The chosen code's
  count sits beside it as `Ltr`, and a "Use this category" button stores the key.
- A code the rule already names and the list has lost stays offered, marked as no longer listed, so the picker never
  reads blank over a stored code.
- The condition reads the catalog only for a key on a FHIR message, so a `$patient` fact costs no read. If that read
  fails, the condition shows no badge and says nothing: the opened catalog gives the reason.
- The legacy date shows as the door sends it, not through a date format.
