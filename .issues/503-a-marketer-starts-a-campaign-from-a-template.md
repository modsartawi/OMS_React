---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 502
---

# 503 — A marketer starts a campaign from a template

## What to build

The Create campaign dialog gets a **From a template** tab: a list of templates (3-for-2, spend-and-get,
points-back… as in the prototype's `sampleTemplates()`), each with a one-line description. Picking one
asks for its **placeholders** (the category, the threshold, the percent…), using the builder's field
pickers where they exist and plain typed inputs otherwise. Then it creates a draft with the
template's rules filled in and opens it.

## Spine reach

model/api (`templates`, create-from-template) · logic (placeholder fill) · component (tab) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `fillTemplate_replacesEveryPlaceholder_andLeavesNoneUnset` · pure
- [ ] drive: template → placeholders → a draft whose rules read the filled values (stubbed) · flow

## Boundaries

Provisional templates endpoint (BackOffice 2759), stubbed.

## Done when

The drive creates a campaign from a template against stubs.

## Blocked by

[502](502-a-marketer-creates-a-campaign-from-a-name-and-features-or-copies-one.md)

## Open questions

- **How a template stores placeholders** is undecided in BackOffice 2759. Default (2759's): a template is a campaign
  draft with named placeholder values that the dialog fills. Build that shape, and adjust when 2759 decides otherwise.
