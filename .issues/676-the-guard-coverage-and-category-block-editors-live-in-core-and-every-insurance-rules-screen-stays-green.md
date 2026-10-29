---
status: open
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; spec C:\Work\DMSCO\BackOffice\.issues\3243-insurance-rule-playground-spec.md)
blocked-by: —
---

# 676 — The guard, coverage and category block editors live in core, and every insurance-rules screen stays green

## What to build

**Prefactor, done first** (brief, "Rule pane": "its own ticket, done first"). The rule playground
(`features/insurance-rules/playground`, 677+) must build rules with the **real** block editors, and a feature may
not import another feature (`.claude/rules/feature-structure.md`, `tools/check-boundaries.mjs`). So the editors
graduate to `core/insurance-rules/editors/`, and the guards and coverage features import them from there. No
behaviour changes.

What moves (verified on main 880090d6):

- from `features/insurance-rules/guards/`: `ConditionEditor.tsx` (with `KeyedListSelect` and the `RuleEdit` type),
  `AudienceEditor.tsx`, `EffectEditor.tsx`, `GuardFormulaBox.tsx`;
- from `features/insurance-rules/coverage/`: `RuleConditions.tsx`, `Effects.tsx` (`CategoryEffectEditor`,
  `CoverageEffectEditor`, `CoverageEffectLine`, `GroupName`, `percentOf`), `parts.tsx` (`PayerMark`), and the pure
  helpers they need: `conditions.ts` (`listSummary`, `renameTest`, `testChoices`) and the parts of
  `ruleset-edit.ts` the editors call (`coverageRuleProblems`, `newCoverageEffect`, `withOverridesPayer`,
  `payerMark`). Their vitest files move with them.

What stays: the pages (`GuardEditorPage`, `GuardPage`, `RulesetPage`, …), the folder tree and anything only a page
uses. Already in core and untouched: `GuardSentenceView`, `ConditionTreeTools`, `controls`, `guard-edit`.

**Decision (overrulable):** the moved editors keep reading the `insurance-guards` and `insurance-coverage`
namespaces. A namespace is a string, not an import, so the boundary holds. Moving the keys into `insurance-rules`
would churn every drive selector and the en/ar files for no behaviour. The `i18n-keys.test.ts` of both features keep
covering their keys. A comment at the top of `core/insurance-rules/editors/` says so.

The editors' props must be enough for a page that is **not** a saved rule. They take the rule or ruleset value and
an edit callback, never a route param or a page query. If an editor currently reaches for a page-only thing (a
folder, a draft id), that becomes a prop. Write that down in the ticket's Comments for 679/680.

## Spine reach

store/logic (pure helpers move) · component (editors move) · test (moved tests + every existing drive)

## Proof (→ `tdd` red-green cycles)

- [ ] every moved `*.test.ts` passes from its new place (`npm test`), and no test was deleted or loosened — pure
- [ ] `node tools/check-boundaries.mjs` and `npm run lint` are green (the control ratchet's allowlist in
      `tools/control-baseline.txt` moves its guards/coverage entries to the core module that now holds them) — pure
- [ ] all 11 `tools/insurance-*-drive.mjs` drives run green as before (at least guard-editor, coverage,
      coverage-seeded, ruleset-folders, simulator, rules) — flow (Playwright drive)

## Boundaries

No new door, no new namespace, no new key. Touches `features/insurance-rules/guards`, `…/coverage` and
`core/insurance-rules`. The baseline file in `tools/control-baseline.txt` changes: say why in the commit.

## Done when

Nothing under `features/insurance-rules/` defines a block editor. Guards, coverage and categories import them from
`@/core/insurance-rules/editors/*`. typecheck, lint, `npm test` and the insurance drives are all green.

## Blocked by

None — can start immediately.
