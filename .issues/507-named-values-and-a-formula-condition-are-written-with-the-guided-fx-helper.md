---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 505
---

# 507 — Named values and a formula condition are written with the guided ƒx helper

## What to build

A rule's **named values** (e.g. Arbahi's points-back amount) and the **formula condition** are written
only through the **ƒx helper**, never in a bare expression box. The helper has **Fields** (the attribute picker
with type badges, plus this rule's filters and values), **Functions** (signature, meaning, example),
**Recipes** (percent of spend, tiered rate, cap, points per SAR, tier tests) and operator chips, each
inserting at the cursor. The **validator** is always on. It sends the formula to HQ (BackOffice 2758 validate /
simulate) and shows the error under the bad word, or the formula's result on the sample basket. An
effect reads a named value by id.

**The client does not re-implement the ADR 0089 expression language.** Syntax and meaning come from HQ.

## Spine reach

model/api (validate formula / try on a basket) · logic (cursor insert, debounce) · component (helper) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `insertAtCursor_placesChipAndKeepsCaret` · pure
- [ ] `formulaCheck_mapsHqErrorSpanToTheUnderline` · pure
- [ ] drive: a recipe → a named value → its result on the sample basket; a typo underlined (stubbed) · flow

## Boundaries

Provisional validate endpoint (BackOffice 2758), stubbed, with a canned error span and a result.

## Done when

In the drive, a named value is written from a recipe and read by an effect, with no expression typed by hand.

## Blocked by

[505](505-a-marketer-adds-and-edits-blocks-from-a-palette-with-undo-redo-cancel-save.md)
