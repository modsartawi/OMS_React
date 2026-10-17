---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 505
---

# 506 — "Certain items…" picks categories, collections or products at every items field, and filters are kept by id

## What to build

Every items field in a panel, whether on a condition or an effect, offers **All items / a named filter / Certain items…**.
**Certain items…** opens the picker **at the field**: categories, collections, and materials **by SKU or
name**, with the lookups searched on HQ. Saving it creates a **named filter** on the rule, referenced **by id**.
Named filters are edited as a chain on the rule card, and **renaming one keeps every condition and effect
that uses it**. "Copy filter from rule N" is offered.

**Prescription (A006)** is excluded by default on a new filter, so the chain reads "not Prescription". A filter or
discount that lets A006 in is flagged **red** on its sentence and chip.

## Spine reach

model/api (lookups: category, collection, material) · logic (filter-by-id ops, Rx check) · component
(picker) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `renameFilter_keepsEveryReference` — references are ids, never the name · pure
- [x] `newFilter_excludesA006_andRxCheckFlagsOneThatDoesNot` · pure
- [x] drive: "Certain items…" on an effect → a material by SKU → a named filter → rename → the sentences follow (stubbed) · flow

## Boundaries

Provisional lookup endpoints (BackOffice 2758), stubbed. The default exclusion list is a `core/rules` constant.

## Done when

The drive picks items at the field, renames the filter without breaking a rule, and shows the Rx flag.

## Blocked by

[505](505-a-marketer-adds-and-edits-blocks-from-a-palette-with-undo-redo-cancel-save.md)

## Open questions

- The prototype's default exclusion is `['A006', 'A008']`, while the brief and spec story 8 name only A006. Default: A006
  only, unless the owner names A008.

## As built

- **Model / api (PROVISIONAL):**
  - `RuleLookupKind` and `RuleLookupItem = { code, name }` are in `core/models/rule-campaign.ts`.
  - The doors are `GET RuleCampaign/Lookups/{Categories|Collections|Materials}?search=` (`ruleCampaignApi.lookup`, `ruleLookupQuery`), with one string per kind in `core/rules/api.ts`. A refusal shows as the door's own message in the picker.
- **Logic (pure, `core/rules/filters.ts`):**
  - `DEFAULT_EXCLUDED_CATEGORIES = [A006]` and `newFilter`.
  - `nextFilterName` and `filterNameProblem` (a name may not be empty or taken, ignoring case).
  - `addFilter`, `updateFilter` and `renameFilter`. A rename touches the filter only, and every block keeps its id.
  - `filterUses` and `blockFilterRefs`, which go by the catalogue's `items` / `itemParts` fields.
  - `deleteFilter`, which deletes only a filter nothing uses.
  - `copyFilterInto` gives the copy a new id and keeps the name unique.
  - `filterLetsRxIn`: A006 not kept out, and not limited to fee lines or to other categories.
  - `effectLetsRxIn`: all merchandise, or a filter that lets Rx in.
- **Screen:**
  - Every items field and bundle part offers all merchandise, the rule's filters (by id) and **Certain items…**. That choice opens `FilterEditor` at the field. It has: look at; category, collection and product (by SKU or name) steps, each searched on HQ; never discount (A006 by default, red with a "Keep Prescription out" button when Rx can get in); and the name.
  - Save filter adds the filter and points the field at it in ONE Undo step.
  - `RuleFilters` draws the rule's filters as chains that open the same editor in place, with live edits and a rename coalesced into one step. It has "Add filter" and "Copy filter from rule…". Delete is disabled while the filter is in use.
  - A filter or discount that lets Rx in is flagged red (`RxFlag`).
- **Proof:**
  - vitest: `src/core/rules/filters.test.ts`, 4 tests, including both named proofs.
  - `tools/campaigns-drive.mjs` passes 225/225, stubbed. 506's checks are 34–43. The flow: Certain items… on an effect → SER-VC found by name and by SKU → a filter named serum → rename to vitc on the card → the sentence follows and the id stays. Also covered: the Rx flags and the fix, a category at a condition's field, copy from rule 1, the save body by id, and a refused lookup.
- **Gates:** typecheck, `npm test` (5313), lint (4 gates) and build are all green.
- **Rulings:** see `.afk/HITL-506.md`. They cover the Rx rule, delete only when unused, the exclusions living on the filter rather than per discount (spec story 8), and name uniqueness.
- **Outstanding (not AFK's):**
  - Owner sign-off on the open-question default (A006 only) and on the HITL rulings.
  - Someone needs to look at the picker and the Rx flags under Arabic.
  - The live lookup doors belong to 520.
