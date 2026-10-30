---
status: done
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

- [x] every moved `*.test.ts` passes from its new place (`npm test`), and no test was deleted or loosened — pure
- [x] `node tools/check-boundaries.mjs` and `npm run lint` are green (the control ratchet's allowlist in
      `tools/control-baseline.txt` moves its guards/coverage entries to the core module that now holds them) — pure
- [x] all 11 `tools/insurance-*-drive.mjs` drives run green as before (at least guard-editor, coverage,
      coverage-seeded, ruleset-folders, simulator, rules) — flow (Playwright drive)

## Boundaries

No new door, no new namespace, no new key. Touches `features/insurance-rules/guards`, `…/coverage` and
`core/insurance-rules`. The baseline file in `tools/control-baseline.txt` changes: say why in the commit.

## Done when

Nothing under `features/insurance-rules/` defines a block editor. Guards, coverage and categories import them from
`@/core/insurance-rules/editors/*`. typecheck, lint, `npm test` and the insurance drives are all green.

## Blocked by

None — can start immediately.

## Comments

**676 done (impl/3243-676).** Pure move, no behaviour change.

- **Where things are now** — `src/core/insurance-rules/editors/`: `ConditionEditor.tsx` (default export, plus
  `KeyedListSelect` and `type RuleEdit`), `AudienceEditor.tsx`, `EffectEditor.tsx`, `GuardFormulaBox.tsx`,
  `RuleConditions.tsx`, `Effects.tsx` (`CategoryEffectEditor`, `CoverageEffectEditor`, `CoverageEffectLine`,
  `GroupName`, `percentOf`), `PayerMark.tsx` (was coverage `parts.tsx` — renamed, since `core/insurance-rules/parts.tsx`
  already exists), `conditions.ts` (+ its test), and `coverage-edit.ts` (+ test): `coverageRuleProblems`,
  `COVERAGE_RULE_PROBLEMS`, `CoverageRuleProblem`, `readsLine`, `newCoverageEffect`, `withOverridesPayer`,
  `payerMark`. `ruleset-edit.ts` keeps only the page's order edits (`moveRule`, `editRuleIn`, `addRule`,
  `nextRuleId`, `newRule`); its test was split, 4 tests stay + 5 moved (none deleted or loosened).
- **Namespaces** — as decided: the editors still read `insurance-guards` / `insurance-coverage`; a header comment in
  every editor file says so. Coverage's `i18n-keys.test.ts` now imports `COVERAGE_RULE_PROBLEMS` from core.
- **Control baseline** — 5 allowlist lines moved verbatim (suffixed "moved from features/insurance-rules, oms 676")
  into a new `core/insurance-rules 5` block; coverage 6 → 4, guards 5 → 2. Total controls unchanged.

**Props a non-saved-rule page needs (for 679/680).** None of the editors reached for a route param, a page query, a
folder or a draft id, so no prop had to be added. What a playground page must hand them:

- Guard — `ConditionEditor({ rule: GuardRule, lists: GuardList[], edit: RuleEdit, checks: ChecksIndex })`,
  `AudienceEditor({ rule, edit })`, `EffectEditor({ rule, edit, checks })`. `RuleEdit = (fn: (r) => r, coalesce?) =>
  void` — the coalesce key is the editor-history's typing merge; a page without history can ignore it. `lists` are
  the document's own lists (GuardEditorPage passes `h.present.lists`); `checks` is a `ChecksIndex` from
  `@/core/insurance-rules/checks` — `indexChecks([], rule)` (no Validate run) and the editors show no issues.
- Coverage / category — `RuleConditions({ when, edit: (fn: (when) => when, coalesce?) => void, lists? })` (lists
  default to none), `CategoryEffectEditor({ effect, onChange })`, `CoverageEffectEditor({ rule: {when, then},
  onChange: (then, coalesce?) => void })`.
- Reads they still do themselves: `fieldsQuery()` and `keyedListsQuery(kind)` from `@/core/insurance-rules/registry-api`
  (the Fields registry and keyed lists, 610). Both are core doors, so the playground needs them stubbed in its drive
  (the existing `tools/insurance-rules-stubs.mjs` registry/keyed-list sections already answer them).

**Drives (DRIVE_PORT=5376, LTR + RTL):** all 13 `tools/insurance-*-drive.mjs` run — approvals 126/126, coverage
172/172, coverage-seeded 52/52, editions 90/90, guard-editor 158/158, lists 204/204 (one RTL flake on the first run,
green on re-run and on the baseline), metrics 110/110, order-guards 106/106, review 108/108, ruleset-folders 56/56,
simulator 126/126, templates 92/92. **rules 84/86 — PRE-EXISTING**: `4. one read of the ruleset` sees
`{"draft":2}` in LTR and RTL on the untouched integration tip 7d9bb824 too (GuardPage reads the draft twice, or the
drive's count is stale); not caused by this move, left for its owner.
