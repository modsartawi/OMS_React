---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 505
---

# 506 — "Certain items…" picks categories, collections or products at every items field, and filters are kept by id

## What to build

Every items field in a panel, whether on a condition or an effect, offers **All items / a named filter / Certain items…**.
**Certain items…** opens the picker **at the field**: categories, collections, and materials **by SKU or
name**, with the lookups searched on HQ. Saving it creates a **named filter** on the rule, referenced **by id**.
Named filters are edited as a chain on the rule card, and **renaming one keeps every condition and effect
that uses it**. "Copy filter from rule N" is offered.

**Prescription (A006)** is excluded by default on a new filter, so the chain reads "not Prescription". A filter or
discount that lets A006 in is flagged **red** on its sentence and chip.

## Spine reach

model/api (lookups: category, collection, material) · logic (filter-by-id ops, Rx check) · component
(picker) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `renameFilter_keepsEveryReference` — references are ids, never the name · pure
- [ ] `newFilter_excludesA006_andRxCheckFlagsOneThatDoesNot` · pure
- [ ] drive: "Certain items…" on an effect → a material by SKU → a named filter → rename → the sentences follow (stubbed) · flow

## Boundaries

Provisional lookup endpoints (BackOffice 2758), stubbed. The default exclusion list is a `core/rules` constant.

## Done when

The drive picks items at the field, renames the filter without breaking a rule, and shows the Rx flag.

## Blocked by

[505](505-a-marketer-adds-and-edits-blocks-from-a-palette-with-undo-redo-cancel-save.md)

## Open questions

- The prototype's default exclusion is `['A006', 'A008']`, while the brief and spec story 8 name only A006. Default: A006
  only, unless the owner names A008.
