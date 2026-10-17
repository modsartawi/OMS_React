---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 505
---

# 507 — Named values and a formula condition are written with the guided ƒx helper

## What to build

A rule's **named values** (e.g. Arbahi's points-back amount) and the **formula condition** are written
only through the **ƒx helper**, never in a bare expression box. The helper has **Fields** (the attribute picker
with type badges, plus this rule's filters and values), **Functions** (signature, meaning, example),
**Recipes** (percent of spend, tiered rate, cap, points per SAR, tier tests) and operator chips, each
inserting at the cursor. The **validator** is always on. It sends the formula to HQ (BackOffice 2758 validate /
simulate) and shows the error under the bad word, or the formula's result on the sample basket. An
effect reads a named value by id.

**The client does not re-implement the ADR 0089 expression language.** Syntax and meaning come from HQ.

## Spine reach

model/api (validate formula / try on a basket) · logic (cursor insert, debounce) · component (helper) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `insertAtCursor_placesChipAndKeepsCaret` · pure
- [x] `formulaCheck_mapsHqErrorSpanToTheUnderline` · pure
- [x] drive: a recipe → a named value → its result on the sample basket; a typo underlined (stubbed) · flow

## Boundaries

Provisional validate endpoint (BackOffice 2758), stubbed, with a canned error span and a result.

## Done when

In the drive, a named value is written from a recipe and read by an effect, with no expression typed by hand.

## Blocked by

[505](505-a-marketer-adds-and-edits-blocks-from-a-palette-with-undo-redo-cancel-save.md)

## As built

- **Model / api (PROVISIONAL):**
  - `core/models/rule-campaign.ts` holds the helper's offer, `RuleFormulaGuide`, which has fields with type badges, functions (signature, example, snippet and caret) and operators. It also holds the recipes, where `{filter}` stands for a filter the marketer picks and `{current}` for the box's own formula.
  - The guide rides on the catalogue as `RuleBlockCatalogue.formula`, so it is still one cached read.
  - The validator's wire is `RuleFormulaCheckRequest` → `RuleFormulaCheck`. HQ answers with `ok` and `type`, errors and warnings (each with a `start`/`end` span), and `result` on the sample basket.
  - The door is `POST RuleCampaign/Formula/Check` (`ruleCampaignApi.checkFormula`, `ruleFormulaCheckQuery`) in `core/rules/api.ts`. A bad formula is an answer (`ok:false`). A refusal means the check could not be made, and its message comes from `apiErrorMessage`.
- **Logic (pure, `workspace/fx.ts`):**
  - `insertAtCursor` places a chip over the selection, or at the caret or the end. It looks only at the characters on either side: a name gets a space next to another name, and an operator's spaces are not doubled. It returns where the caret goes.
  - `operatorChip` gives `()` with the caret inside.
  - `recipeFormula` / `recipeNeedsFilter` / `recipeNeedsCurrent` fill and read a recipe's slots.
  - `valuesBefore` and `checkRequest`: a value reads only the values above it, and the formula condition reads them all.
  - `fxFields` lists the rule's filters, the values above, then HQ's fields.
  - `readFormulaCheck` maps HQ's first error span to `{before, bad, after}`. The span is held to the formula; an empty span marks one character, or a space at the end. It also passes on the result and warnings.
  - The client parses nothing (ADR 0089).
- **Logic (pure, `workspace/value-edit.ts`):**
  - add, update, move and delete a value. A value that an effect reads cannot be deleted.
  - `valueUses` counts by id or by the samples' older by-name reference. `pinValueRefs` turns a by-name reference into an id before a rename.
  - `valueNameProblem` treats a value's name as taken if a value **or a filter** has it. `core/rules/filters.ts` `filterNameProblem` now also refuses a value's name.
- **Components:**
  - `FormulaBox` holds the input, the ƒx button and the validator, which is always on. The validator waits 300 ms after typing stops (`useDebounced`, moved from `FilterEditor` to `builder-ui`). It shows the bad word underlined with HQ's message and `aria-invalid`, or "Valid · gives …" with the result on the sample basket (money via `moneyText`). An insert or a recipe is one Undo step, and a run of typing is one step.
  - `FxHelper` has the Fields tab (search, groups, type badges), the Functions tab (signature, meaning, example) and the Recipes tab (offered by the box's `expect`, with a filter picker). Below them are the operator chips and a text chip.
  - `RuleValues` makes Named values editable: name, `=`, `FormulaBox`, up and down, and a delete that is disabled while the value is in use.
  - `BlockPanel`'s `formula` field is a `FormulaBox`. It expects a yes / no test in a condition, else a number.
  - `palette.ts` drops `NOT_YET_EDITABLE`, so the Formula (advanced) condition is offered.
- **i18n (en only):** `fx.*` and `values.*`. The meanings of fields and functions are this bundle's words around HQ's paths and signatures; a path the bundle does not know shows as an isolated code. `panel.formulaReadOnly` is gone.
- **Stubs:** `tools/campaigns-fixtures.mjs` adds `CATALOGUE.formula`, built from the prototype's ATTRS (the decided ones), FUNC_DOCS, OPS and recipesFor. It also adds `checkFormula`, a canned check: an unknown word comes back as an error with its span, and anything else is valid with 12.5 (or yes for a test). This is not an expression language.

## Proof — as run

- vitest `fx.test.ts` (5, including the two named tests) and `value-edit.test.ts` (5). `palette.test.ts` now expects the formula block to be offered. Full suite: 314 files, 5323 tests, all green.
- Drive `tools/campaigns-drive.mjs` (stubbed): **260/260**. Its 507 section is checks 44–52:
  - the validator is always on, and the request carries only the values above;
  - Recipe → Use → the result 12.5, one Undo step;
  - a field picked over a selection, with the caret after it;
  - the award picks the value by id;
  - a typo is underlined at HQ's span and mended from Fields, and an operator chip goes in at the caret;
  - a debounced check is made once for the typed formula;
  - Save sends the value and the reference by id;
  - a refused check shows the door's message.
  The 505 checks 18, 25 and 32 were updated: values are now inputs, the formula block is offered, and the formula is in the ƒx box. 506 check 40's copy changed to "a filter or a value".
- typecheck, lint (4 gates) and build are clean.
- **Done when holds:** check 50 saves `cashback = round(spend * 10 / 100, decimals, halfUp)`, written from a recipe and a field pick, and the award reads it by id. No expression was typed by hand.

## Outstanding (not this session's)

- Live door: BackOffice 2758 validate is unbuilt. Ticket 520 re-points it.
- Owner sign-off on the decisions in `.afk/HITL-507.md`.
