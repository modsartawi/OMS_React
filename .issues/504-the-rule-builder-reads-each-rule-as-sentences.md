---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 501
---

# 504 — The rule builder reads each rule as sentences

## What to build

The workspace's **Rule builder** page shows the campaign's rules top to bottom as collapsible cards, each
with a one-line summary. Inside a card:

- the rule's **named cart-item filters** as a chain ("Shampoos = category X, not Prescription");
- **When** (all / any) conditions as sentences ("the subtotal of Shampoos is at least SAR 100.00");
- **Then** effects as sentences ("take 15% off each item of Shampoos");
- a rule with **no condition** is legal and reads "always", as for a bundle, a value map or "for each item in X".

Sentences are built by a pure `core/rules/sentence.ts` from the **block catalogue** (types, fields, units,
palette groups), which is fetched once and cached. Filters are shown by their current name, looked up by
id. Values are isolated by kind (money and counts in `Ltr`, names in `<bdi>`), and each sentence is formatted whole.

## Spine reach

model/api (`catalogue`) · logic (`sentence.ts`) · component (builder page, read-only) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `sentence_rendersEveryCatalogueBlock_ofThePrototypeCampaigns` — no raw type id leaks · pure
- [ ] `sentence_namesAFilterByItsCurrentName_viaId` · pure
- [ ] drive: the builder shows a stubbed campaign's rules as sentences; collapse / expand · flow

## Boundaries

Provisional catalogue endpoint (BackOffice 2758), stubbed. Sentence templates live in the namespace JSON (zero
literal). Values go in through `<Trans>` slots, following the bidi rule.

## Done when

Every prototype sample campaign renders as sentences with no raw keys, and the gates are green.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)
