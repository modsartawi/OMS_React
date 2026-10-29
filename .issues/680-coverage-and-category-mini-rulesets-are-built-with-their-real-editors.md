---
status: open
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; stories 24-27, 29, 34)
blocked-by: 679
---

# 680 — Coverage and category mini-rulesets are built with their real editors

## What to build

679's Rule pane for the other two kinds.

- **category:** 1..n rules in order, each with core's `RuleConditions` + `CategoryEffectEditor`. The order is the
  point: the first matching rule sets the category, as on the Categories page.
- **coverage:** 1..n rules with `RuleConditions` + `CoverageEffectEditor`, plus the document's `lists[]` that the
  conditions name (`{ check: "line", inList }`, ticket 674).
- The JSON stays live both ways, through the same codec `RulesetPage` saves with (`core/insurance-rules/coverage-model`).
  A block the editors cannot show stays JSON-only with a note.
- The sentence view and reader errors on the block, as in 679.

Reuse 679's ruleset list and its error mapping. Generalise them over kind; don't copy them.

## Spine reach

store/logic (coverage/category document ⇄ editors) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `rulesetRoundTrip` (coverage + category cases) — read and printed back unchanged, lists kept, an unknown block
      kept JSON-only — pure
- [ ] drive: a category experiment with two rules in either order shows tab B's category changing with the order (stub
      honours first-match); a coverage rule on an in-list condition edits and runs — flow

## Boundaries

No new door. No new namespace.

## Done when

Coverage and category experiments are built with their real editors, with the JSON in step. Drive and vitest are
green.

## Blocked by

[679](679-a-guard-mini-ruleset-is-built-with-the-real-editors-and-the-engine-json-is-live-beside-them-both-ways.md)
