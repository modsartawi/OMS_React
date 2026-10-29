---
status: open
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; stories 30, 31)
blocked-by: 680, 687
---

# 688 — "Open in playground" on a guard, coverage or category rule copies it and its lists into a new experiment

## What to build

An **"Open in playground"** action on:
- the guard rule page (saved or published version shown);
- the Coverage and Categories rule screens (the selected rule).

It copies the rule, the lists it names and the fields it declares into a **new** experiment of that kind, with
example data and as-of now, and opens `/insurance-rules/playground` on it. It is a **copy**: nothing the playground
does ever writes back, and the playground has no save-to-HQ control at all.

The hand-off goes through core, never a cross-feature import. The rule screens build the experiment with
`core/insurance-rules/experiment.ts` (687) and pass it by router state, with a short-lived storage fallback so a
reload of the playground keeps it. The playground reads it once.

## Spine reach

store/logic (rule → experiment copy) · component (action on three screens, playground reads the seed) · i18n
(action label in `insurance-guards` and `insurance-coverage`, en + ar) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `experimentFromRule` — a guard rule, a category rule and a coverage rule with an in-list condition each become
      a one-rule document of their kind carrying exactly the lists they name; the source rule object is not mutated — pure
- [ ] drive: from a stubbed guard rule page and a coverage rule, Open in playground, see the rule in the editors,
      edit it, and the source screen is unchanged — flow

## Boundaries

No new door. Touches guards, coverage and playground features. `check-boundaries` must stay green.

## Done when

Each of the three rule screens opens its rule as a playground copy. Vitest, drive and boundaries are green.

## Blocked by

[680](680-coverage-and-category-mini-rulesets-are-built-with-their-real-editors.md),
[687](687-experiments-are-kept-by-name-in-the-browser-and-exported-or-imported-as-a-versioned-json-file.md)
