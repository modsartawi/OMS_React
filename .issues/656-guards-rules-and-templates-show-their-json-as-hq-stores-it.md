---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md); owner ask 2026-10-29
blocked-by: 618
---

# 656 — Guards, rules and templates show their JSON as HQ stores it

## What to build

A **JSON** button that opens the document read-only, with Copy, in the SIS.Rules rule language exactly as HQ stores
it (after the wire codec, so no screen-only `filters` and every list alias resolved):

- **Guards list**: the whole guard draft (every rule and item list) at its revision;
- **Rule page**: the rule;
- **Editor**: the rule as it stands, unsaved edits included;
- **Templates**: each template card (id, origin, name, conflict code, blanks as paths, its rule);
- **Use this template**: the rule the dialog will create, blanks and folder filled.

One core component, `@/core/insurance-rules/JsonButton` (the `insurance-rules` namespace's `json.*` words, EN + AR);
a template's stored shape is `templateOut` beside `templateIn`.

## Spine reach

ui · test

## Proof (→ `tdd` red-green cycles)

- [x] `templateOut` reads back what `GET …/Templates` sent: rule in the engine spelling, no id / state / filters, blanks as paths
- [x] walked on the owner's local SIS.Api: the Duplicate dispense card shows `codes.nphies` AD-2-4 (BO SQL 065); the Guards
      list shows draft revision 2 with no `filters` key

## Boundaries

Read-only: nothing here writes. Rules: `feature-structure`, `i18n-zero-literal` (EN + AR), `bidi` (the JSON is one
left-to-right island).

## Done when

Each of the five places opens its JSON and copies it.
