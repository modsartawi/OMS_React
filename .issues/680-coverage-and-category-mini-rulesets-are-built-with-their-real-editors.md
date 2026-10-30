---
status: done
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

- [x] `rulesetRoundTrip` (coverage + category cases) — read and printed back unchanged, lists kept, an unknown block
      kept JSON-only — pure
- [x] drive: a category experiment with two rules in either order shows tab B's category changing with the order (stub
      honours first-match); a coverage rule on an in-list condition edits and runs — flow

## Boundaries

No new door. No new namespace.

## Done when

Coverage and category experiments are built with their real editors, with the JSON in step. Drive and vitest are
green.

## Blocked by

[679](679-a-guard-mini-ruleset-is-built-with-the-real-editors-and-the-engine-json-is-live-beside-them-both-ways.md)

## Comments

- 2026-10-30 (680 built, branch `impl/3243-680`). vitest `ruleset.test.ts` +8 (coverage + category round trip
  byte-for-byte, move order, edit spelling with lists kept, JSON-only rules, new rule ids, lists per kind, errors on a
  coverage block). Drive `tools/insurance-playground-drive.mjs` 216/216 (LTR + RTL; old step 20 "no editors yet"
  replaced by steps 20–23). Re-ran the coverage page drives (coverage 172/172, coverage-seeded 52/52, ruleset-folders
  56/56) and the other playground drives (experiments 62, form 52, raw 52, reads 46): all green. typecheck, lint,
  test, build green.
- **Generalised, not copied:** `playground/ruleset.ts` gained `categoryCodec` / `coverageCodec` (one `otherCodec`
  over `guard-wire`'s `otherRuleIn` / `otherRuleOut`, now exported: the rule halves of the `rulesetIn` / `rulesetOut`
  that the Categories / Coverage pages save through) and a `lists(doc)` slot on `RuleCodec` (`rulesetLists(read)`).
  `RulePane` holds one ruleset list for every kind; `RuleCard` swaps `GuardRuleEditors` / `OtherRuleEditors`.
  The error mapping (`errorAtBlock`, `rulesetIssues`) is unchanged and already kind-agnostic.
- **Core moves:** `nextRuleId` / `newRule` moved from `features/insurance-rules/coverage/ruleset-edit.ts` to
  `core/insurance-rules/coverage-model.ts` (re-exported from `ruleset-edit.ts`, so the page's callers and tests are
  unchanged). `RuleConditions` takes an optional `checks: ChecksIndex` and marks a block with its issues the way the
  guard `ConditionEditor` does. Without the prop, as on the rule screens, nothing changes.
- **Decisions (overrulable):** a category rule is editable only with exactly one `setCategory` to G1|G2|G3. A coverage
  rule is editable with at most one effect, of a known kind with a value of that kind's type (the editor draws only
  `then[0]`, so a second effect would be invisible). Any block outside the guard language is JSON-only. A new rule
  is `newRule` minus `state` (K-NNN sets G2, C-NNN sets nothing yet). Above the rules the pane shows the Categories /
  Coverage pages' own order sentence (`insurance-coverage:{kind}.order`). `rule.hintEditors` is no longer about guard
  rules only (en + ar).
- **Stub `// --- 680 ---`:** `playgroundInList` evaluates `{ check: "line", inList }`: true when the line's `item` is
  in the document list's `filters[].articles`, unknown for a list the document lacks. 691 must reconcile it with the
  engine's real list filters (categories, attributes, include/exclude).
