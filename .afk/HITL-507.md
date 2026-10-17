# HITL — ticket 507 (guided ƒx helper, named values, formula condition)

I re-read the brief at the start of 507. It still has **no contract section**, so the validate door is a provisional one invented here: `POST RuleCampaign/Formula/Check`.

## Q: Where do the helper's Fields, Functions, Recipes and operators come from?
**Decision taken:** From HQ, on the block catalogue (`RuleBlockCatalogue.formula: RuleFormulaGuide`), so they are still one cached read.
- HQ sends the paths, signatures, examples, snippets, operators and recipe formulas.
- The en bundle has the words around them: field labels and descriptions, the meaning of each function, recipe titles. A path or recipe the bundle has no words for shows as an isolated code.
**Why:** ADR 0089 says the language is HQ's, so the client must not hard-code the language's vocabulary. The words are i18n, by the zero-literal rule.
**Revisit if:** 2758 wants a separate door for the helper, or sends the meanings itself. Then the `fx.function.*` / `fx.field.*.desc` keys go, because they restate HQ semantics (the standards review flagged this as a Shotgun Surgery risk).

## Q: What does the check door take and answer?
**Decision taken:**
- **Request:** `{ campaignId, expect: 'number'|'bool', formula, filters, values }`. The filters and values are the rule as it is on screen (unsaved), and `values` holds only those above the value being written.
- **Answer:** `{ ok, type, errors[{code,message,start,end}], warnings[...], result }`.
- A bad formula is `ok:false` on a successful envelope. An envelope refusal means "could not check", and it shows the door's message under the box.
**Why:** The ticket asks for "the error under the bad word, or the formula's result on the sample basket". The prototype's validator also reads only the values above (`upTo`).
**Revisit if:** 2758 checks a whole saved draft by id, or reports errors as envelope refusals.

## Q: Does a recipe insert at the cursor or replace the formula?
**Decision taken:** **Use** replaces the whole formula, as the prototype's `insert(text, replaceAll)` does. Fields, functions and operators insert at the cursor. "Cap what you have" (`min({current}, 100)`) wraps the box's own formula, as in the prototype, and needs one written first.
**Why:** A recipe is a whole formula; inserting it in the middle of another one would make nonsense.
**Revisit if:** The owner wants recipes inserted at the caret.

## Q: Does a value's name have to follow any syntax (no spaces, not a function name)?
**Decision taken:** No. The client checks only that the name is not empty, and that no other value **or filter** in the rule has it (both are read by name inside a formula). Whether a name is a valid word of the language is HQ's to report, on the formula box that uses it.
**Why:** Judging names would mean the client knowing the expression grammar (ADR 0089).
**Revisit if:** 2758 publishes a name pattern. It could then ride on the guide and be checked at the name input. The same applies to filter names used in recipes (`sum(Vitamin C)`).

## Q: Filter and value names share one namespace — does that change 506?
**Decision taken:** Yes, a little. `filterNameProblem` now also refuses a named value's name, and the copy reads "This rule already has a filter or a value with this name."
**Why:** A formula reading `x` must not match both a filter and a value.
**Revisit if:** HQ scopes filters and values separately.

## Q: What happens to a formula when a value it names is renamed?
**Decision taken:** An effect that reads the value is kept, because it reads it by id. A by-name reference from the samples is pinned to the id before the rename. A **formula** that names the old value is not rewritten, because that would mean parsing it. HQ's check then flags that formula on its own box.
**Why:** ADR 0089.
**Revisit if:** 2758 rewrites formula references on a rename, or stores formulas with ids.

## Q: Out-of-ticket additions
**Decision taken:** These were built:
- moving a value up and down, since a value reads only those above it;
- a text chip (`'…'`) among the operators;
- a search on the Fields tab (both are in the prototype).
Save is **not** blocked by a bad formula. A draft may be saved with errors; blocking is 508's checks pill.
**Why:** The prototype has them, and ordering is meaningful.
**Revisit if:** The owner wants 507 trimmed.

## Note: re-checks
Every formula box sends a check when it opens, and again when its formula or the rule's filters or values change (300 ms after typing stops). A filter rename therefore re-checks every box on the card. That is intended, because a rename can break a formula. The query is cached per request.

## Note: glossary
"Named value", "formula condition", "recipe" and "sample basket" are not in `CONTEXT.md`. Neither are the rule-engine terms of 501–506. A `/domain-modeling` pass should add them.

## Note: the BackOffice brief
Nothing found wrong there.
