# HITL — 508 (checks pill)

## Q: Does the client validate the draft on screen, or read HQ's checks of the saved draft?
**Decision taken:** `GET RuleCampaign/Campaigns/{id}/Validate` checks the SAVED draft; Save invalidates it and the pill asks again. While there are unsaved changes the list says the checks are the last save's.
**Why:** the ticket says "HQ validates the draft on save", and 511's Ask for approval sends the saved draft, so both read one query.
**Revisit if:** 2758 validates an unsaved draft body (then POST the rules on screen, debounced, like the ƒx check).

## Q: Message shape?
**Decision taken:** `{ severity: 'error'|'warning', code, message, ruleId|null, blockId|null, field|null }`; blockId covers conditions (incl. in groups), effects, filters and named values; null ruleId = campaign-wide.
**Why:** the ticket points rule → block → field by id; filters and values are blocks of a rule since 506/507.
**Revisit if:** 2758 writes a path (indexes) instead of ids, or a separate kind field.

## Q: An unknown severity?
**Decision taken:** treated as an error — it blocks approval.
**Why:** fail closed while the contract is provisional.
**Revisit if:** 2758 adds an "info" level that should never block.

## Q: Pill wording "2 errors · 1 warning"?
**Decision taken:** two adjacent count badges ("2 errors" "1 warning") with icons, no "·" glued in a template.
**Why:** a locale template gluing two counts is a bidi tell (.claude/rules/bidi.md); the badges read the same.
**Revisit if:** the owner wants the literal one-string form.

## Q: Where does a filter's or named value's message show?
**Decision taken:** on the filter / value row (all its messages); the jump opens the filter editor and focuses the named field's control (name, scope, or the pick's search), or the value's name / formula input. Condition and effect messages show AT the panel field.
**Why:** keeps the FilterEditor / FormulaBox internals untouched in this slice.
**Revisit if:** a reviewer wants per-field notes inside the filter editor too.

## Q: Field marks while editing after a save
**Decision taken:** marks follow the last save's checks found by id on the rules on screen; a block deleted since reads "No longer in the rules" under its rule, not jumpable, and still counts toward the verdict.
**Why:** HQ checked the saved draft; that is what approval sends.
**Revisit if:** the owner wants marks hidden while dirty.
