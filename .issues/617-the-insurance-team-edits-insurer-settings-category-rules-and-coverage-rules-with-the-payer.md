---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 608
---

# 617 — The insurance team edits insurer settings, category rules and coverage rules, with the payer-override mark shown

## What to build

**Insurer settings** per insurer with the change log. **Category rules**: an ordered list (first match wins)
setting Generic / Brand / NonMed. **Coverage rules**: covered, prior approval, deductible % + max, price cap,
quantity cap, segment — each value marked filled vs **overrides payer**. Eligibility facts appear in the palette.

**HQ contract:** the brief's sections for BackOffice 3144, BackOffice 3145, BackOffice 3146. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components · test

## Proof (→ `tdd` red-green cycles)

- [x] drive (stubbed) — K-001 and "no deductible for these policies"

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[608](608-an-author-edits-a-guard-from-a-palette-with-nested-all-of-any-of-groups-and-not-severity-e.md)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.

## Comments

**2026-10-27 — built on `impl/3126-617`.** Feature `src/features/insurance-rules/coverage/` (namespace
`insurance-coverage`, en + ar mirror-tested): `/insurance-rules/insurers` (InsurersPage, `?payer=`),
`/insurance-rules/categories` and `/insurance-rules/coverage` (one `RulesetPage`, `?rule=`); three menu leaves in the area
group. Proof: `coverage/ruleset-edit.test.ts` (moveRule_changesWhichRuleMatchesFirst, ids, payer mark, new effects
fill), `coverage/settings.test.ts` (settings refused in words before the PUT), `coverage/i18n-keys.test.ts`,
`core/insurance-rules/registry-facts.test.ts` (eligibilityFacts_appearInThePalette), `menu-insurance-rules.test.ts`; drive
`tools/insurance-coverage-drive.mjs` 122/122 STUBBED (LTR + RTL): K-001 "Bupa: Glucophage XR is Brand" built from the
palette (payer BUPA + item code 100245 → Brand G2) under the next free id K-003 (as 608 built G-007 under a new id), moved
first, Undo / Redo of the move, the whole draft PUT in its new order; "SASREF: no deductible for these policies" (policy
list `PO-SASREF` → deductible 0 %, no cap, overrides the payer) with the mark on the value, the row and the reads-as;
a stale revision; Bupa's settings refused / saved / logged; eligibility facts in the guard palette; bare 403s. 607's
drive 86/86, 608's 88/88, 610's 140/140 still. Typecheck, lint, vitest green.

**608 follow-up done here (the palette reads 610's registry):** `core/insurance-rules/registry-facts.ts` (`factPath`,
`fieldOfPath`, `factFields`, `dateFields`, `lineFields`, `unitKey`). 608's `FACTS` / `LINE_FIELDS` / `factOf` are
gone from `guard-edit.ts` (`DEFAULT_FACT_PATH` stays for a new fact block). The guard `fact` block lists the
registry's live non-date fields grouped by scope (new `editor.factScope.*` keys); the `line` block's numbers are the
registry's request-scope numbers and its "after" is a pick of the registry's date fields (was a free `$`-path box);
`patient` / `policy` blocks pick a list from `keyedListsQuery` (was a typed id). `guardSentence(rule, lists, fields?)`
reads a fact by its registry label and unit (`sentence.fact.unit.percent` added); without the registry a fact reads
as its `$`-path. 608's drive now serves 610's registry stubs and selects the patient / policy lists. The
`insurance-guards` `editor.fact.*` and `insurance-rules` `sentence.fact.name.*` keys are now unused (left to avoid
merge churn; 618 may drop them).

**Shared pieces:** `core/insurance-rules/coverage-model.ts` (category / coverage ruleset shapes, for 612's simulator
and 618). Stubs `// --- 617 ---`: `COVERAGE_FIELDS` (request / patient / item / eligibility facts beside 610's
`FIELDS`, whose counts 610's drive asserts), `POLICY_LIST_SASREF`, `INSURERS`, `INSURER_SETTINGS`, `SETTINGS_LOG`,
`CATEGORY_RULESET`, `COVERAGE_RULESET`, `K_001`, `NO_DEDUCTIBLE`, `newCoverageState()`, `validateRuleset`,
`coverageStub` (falls through to 610's `insuranceListsStub`).

**Guesses where the brief is silent (618 reconciles):**
- Fact `$`-paths are `$<scope>.<key>` of the registry field (`$request.payer`, `$item.ItemCode`,
  `$eligibility.benefit.dayBenefit`); 608 had guessed `$line.icd` etc. The brief's `benefit[code].copayPct` is
  modelled as plain keys (`benefit.genericCopayPct`); no per-code templating.
- An insurer is a condition (`$request.payer` any of), not a field of the rule; category / coverage rules have no
  `filters`, `audience`, `window` or `onUnknown`.
- Documents: `{ schema: 1, kind: 'category' | 'coverage', revision, rules }`; rule `{ id, name, folder, state, when,
  then }`; a category rule has ONE `setCategory` effect; a coverage rule any number, at most one of each kind. Ids
  `K-nnn` / `C-nnn` minted client-side; a new rule goes LAST.
- Coverage effect fields: `covered { covered }`, `priorApproval { required }`, `deductible { pct, max|null }`,
  `priceCap { max }` (SAR per unit), `qtyCap { maxQuantity|null, maxDaysSupply|null }`, `segment { segment:
  Elite|SABIC|ARAMCO }`, each with `overridesPayer`; a new value fills (does not override).
- `GET InsuranceRules/Insurers` → `[{ payer, name }]` (no list door in the brief). Settings shape: `{ payer,
  fixedDiscountPct|null, receivableCustomer|null, memberId { length|null, format (a pattern)|null },
  benefitCategories [{ code, meaning }], daysSupply { min|null, max|null }, directDispense { allowed,
  defaultDayBenefit|null }, payerPins [{ documentType, payer }] }`; the PUT takes and answers the whole settings.
  Log row `{ at, by, changes: [{ field, from, to }] }`, newest first.
- Validate for categories / coverage answers the guards' issue shape; issues shown per rule (no block pinning).
- Not built here: Submit / Approve / Versions for these rulesets (611 builds them for guards on the same doors), and
  "which rule set each line" in the simulator (612's screen). No access probe: a bare 403 reads "You do not have access".
- Layout follows the prototype (ordered list + editor + reads-as); the insurance team's walk (BackOffice 3096) is open.


**2026-10-27 — 3126 review (P6).** (a) The simulator names each line's category and the category rule that set it,
linked to `/insurance-rules/categories?rule=…`, or "from the item master" (GUESS: Simulate's line answers
`category: { group: G1|G2|G3, ruleId|null }`; `simulate.ts` `lineCategory`, drive step 5b). (b) Category and coverage
rulesets get Submit / Approve / Send back and Versions / Restore on "the same authoring doors"
(`InsuranceRules/{Categories|Coverage}/Approval|Submit|Approve|SendBack|Versions|Versions/{v}/Restore`): 611's pure
`actionsFor` / `DraftApproval` moved to `core/insurance-rules/approval.ts` (with `needsBacktest: false` and `dirty`),
the doors are core `rulesetApprovalDoors` (611 uses them too), and the panel is core `RulesetApproval.tsx` (area
namespace `insurance-rules:approval.*`) on `RulesetPage`. Drive step 7 (submit, own-submission refusal, approve by a
different user, versions, restore).
**Guesses:** the same `GET …/Approval` read 611 guessed; no back-test is asked for a category / coverage draft;
approval is asked for the SAVED revision (unsaved edits disable it); rule states (draft → waiting → shadow → live) are
NOT moved for these rulesets and they have no Promote — left for 618 to settle with BackOffice 3145 / 3146.
