---
status: done
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

- [x] `experimentFromRule` — a guard rule, a category rule and a coverage rule with an in-list condition each become
      a one-rule document of their kind carrying exactly the lists they name; the source rule object is not mutated — pure
- [x] drive: from a stubbed guard rule page and a coverage rule, Open in playground, see the rule in the editors,
      edit it, and the source screen is unchanged — flow

## Boundaries

No new door. Touches guards, coverage and playground features. `check-boundaries` must stay green.

## Done when

Each of the three rule screens opens its rule as a playground copy. Vitest, drive and boundaries are green.

## Blocked by

[680](680-coverage-and-category-mini-rulesets-are-built-with-their-real-editors.md),
[687](687-experiments-are-kept-by-name-in-the-browser-and-exported-or-imported-as-a-versioned-json-file.md)

## Comments

- 2026-10-30 (688 built, branch `impl/3243-688`). vitest `core/insurance-rules/experiment-from-rule.test.ts` (5) +
  `playground-handoff.test.ts` (3). Drive `tools/insurance-playground-open-drive.mjs` 52/52 (LTR + RTL). Re-ran
  guard-editor 158/158, coverage 172/172, playground 216/216, playground-experiments 62/62, playground-lessons 102/102; rules 84/86
  with the same PRE-EXISTING "one read of the ruleset" pair recorded in 675/676. typecheck, lint (boundaries green),
  test, build green.
- **Core:** `experiment.ts` gained `experimentFromRule({ kind, rule, document }, asOf)` (rule + document in the ENGINE
  spelling — `guardRuleOut` / `guardRulesetOut`, `otherRuleOut` / `rulesetOut`) → a v1 `PlaygroundExperiment`: name =
  the rule id, a one-rule document (`revision: 0`), the document lists the rule names (`match: list:<id>`, any
  `inList`, a supply's `eligibleDaysBeforeDueFor[].list`, the audience's exclude lists) plus those lists' `include` /
  `exclude` closure, in document order; the declared `fields` the rule reads (a string equal to the key, or
  `field.<Key>` in a formula, ADR 0117); example data; everything deep-copied. A team list the document does not hold
  (patient / policy / class) is simply not carried — the playground stub never needed one. `example-data.ts` is the
  example dataset graduated from `playground/experiment.ts` (`SEED_DATA` / `SEED_COVERAGE_PAYER` are now re-exports, so
  `kindSeed` and its callers are unchanged). `playground-handoff.ts`: router state `{ playgroundCopy: { file, from } }`
  plus a `sessionStorage` stash (`oms.insurance-playground.handoff.v1`, 30 min) read ONLY on `?open=copy`, so the menu
  link never re-opens an old copy. `OpenInPlayground.tsx` is the button (core `Button`; label/title from the screen).
- **Screens:** the guard rule page copies the rule shown (the draft read); the Categories / Coverage editor copies the
  rule as last SAVED (`h.saved`) — unsaved edits are not copied, and a never-saved rule's button is off with a title
  saying so. The playground reads the hand-off once on arrival through 687's `loadExperiment`, and says "A copy of rule
  X…" until the experiment is replaced (open, lesson, kind switch). No save-to-HQ control anywhere.
- **Decisions (overrulable):** copy the SAVED coverage/category rule, not the on-screen edits (story 30 says "saved or
  published"); 30-minute reload stash; the experiment's name box is left empty (the bar keeps its own name state).
- **681 / 691:** if 681 changes the document's `fields` spelling (anything other than `{ key, … }`), `experimentFromRule`'s
  field filter must follow.
