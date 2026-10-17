# HITL — ticket 506 ("Certain items…", filters kept by id, Rx flag)

I re-read the brief at the start of 506. It still has **no contract section**, so the lookup doors are the runner's provisional ones: `GET RuleCampaign/Lookups/{Categories|Collections|Materials}?search=`, each answering `RuleLookupItem[] = { code, name }`.

## Q: Default exclusion: A006 alone, or A006 and A008 (the prototype)?
**Decision taken:** A006 only (`DEFAULT_EXCLUDED_CATEGORIES` in `core/rules/filters.ts`). This is the ticket's open-question default.
**Why:** The brief and spec story 8 name only A006, and the runner ruled it.
**Revisit if:** The owner names A008 (infant formula). The fix is one constant.

## Q: When is a filter flagged as letting Rx in?
**Decision taken:** A filter is flagged when it does **not** keep A006 out, **unless** it cannot reach a Prescription line anyway. That is the case for a filter held to fee lines, or one whose category step names only other categories (`category A002`). A collection or a product is not known to be Rx-free, so it is flagged. A discount is flagged when one of its items fields is all merchandise, or a filter that lets Rx in. The filter editor's red line uses the same rule.
**Why:** The steps narrow each other, so a category-only filter without A006 cannot match an A006 line. The prototype flags every filter with an empty exclusion list, which would flag "beauty = A002" red for nothing.
**Revisit if:** The owner wants the prototype's stricter rule (flag whenever A006 is not in the exclusions).
**Note:** Several sample campaigns (SUN-3FOR2, BABY-BUNDLE, GIFT-POUCH) have filters with no exclusion. They now show red, as the prototype would.

## Q: Which effects count as a "discount" for the Rx flag?
**Decision taken:** Every effect with an `items` or `itemParts` field in the catalogue: item and session discounts, free units and bundles. Points, messages, value maps, free products (by SKU) and fee discounts are not checked.
**Why:** The catalogue's field kinds say which blocks work on cart items. The palette group key is a fixture guess.
**Revisit if:** HQ adds a points-on-items effect that should never reach Rx, or wants free products checked by the SKU's category (that needs a lookup).

## Q: Where are the never-discount categories set: on the filter, or on each discount (spec story 8)?
**Decision taken:** On the filter (`exclCats`), as the ticket, the prototype and the provisional shape have it. A discount on all merchandise has no list of its own. It is flagged, and the fix is to point it at a filter (one "Certain items…" away, A006 kept out by default).
**Why:** Story 8 says "each discount names its own never-discount categories", and the ticket and the prototype put that list on the filter the discount uses. An exclusion field on every discount block would be a second place for the same list.
**Revisit if:** 2758 puts an exclusion list on the discount block itself.

## Q: May a filter that is in use be deleted?
**Decision taken:** No. Delete is disabled while any condition, effect or bundle part uses the filter, with "Used by N conditions or effects". An unused filter can be deleted.
**Why:** If deleting were allowed, its blocks would point at nothing, and clearing them to all merchandise would silently widen a discount, Rx included.
**Revisit if:** The owner wants delete to also reset the blocks that use it.

## Q: What is a new filter called, and may two filters share a name?
**Decision taken:** It is called `items1`, `items2`, … (the first free number; the base word is the locale's `filters.defaultName`). A name may not be empty and may not repeat another filter's name in the rule, ignoring case. Save filter and Done stay disabled until the name is fixed. If an editor closes another way, the chain shows the problem.
**Why:** Filters are picked by name in every items field, so two "sun" filters could not be told apart. The prototype uses `'items' + k`.
**Revisit if:** 508's checks pill should own the name check.

## Q: How does the picker find things?
**Decision taken:** Each step (categories, collections, products, never-discount) has its own search box. It calls the lookup 250 ms after typing stops, and a hit reads `code · name`. Chips show the code only, because the provisional wire stores codes. A material is matched by SKU or by name on HQ's side.
**Why:** The client never knows the whole catalogue, and the ticket says "searched on HQ".
**Revisit if:** The chain should show names (it would need a lookup per code, or names on the wire).

## Q: Is the "Certain items…" draft part of Undo?
**Decision taken:** No. The draft is local to the field until Save filter. Save adds the filter and points the field at it in **one** history step, so one Undo takes back both. Cancel, or the panel's Done, drops the draft without saving it.
**Why:** A half-built filter should not be an Undo step or count as unsaved.
**Revisit if:** The owner wants Done to save an open draft, or to ask first.

## Note: the Rx flag's form
The flag is a red pill beside the filter's chain ("Rx not excluded") and under the discount's sentence ("Discounts Prescription items"), and the discount's border turns red. The prototype writes "Rx not excluded" inside the filter sentence itself. Someone needs to look at this, and at the Arabic rendering.
