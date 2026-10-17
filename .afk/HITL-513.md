# HITL — 513 (Priority: the evaluation order)

I re-read the brief at the start of 513. It still has **no contract section**, so the door is provisional: `GET RuleCampaign/Order` and `PUT RuleCampaign/Order` (`src/core/rules/api.ts`). The shapes are `RuleEvaluationOrder { base: ({c}|{g})[], groups: {id,name,mode,scope,items}[] }` in `rule-campaign.ts`, with the field names taken from the prototype's `data.js` `tree`.

## Q: Is there one order for the estate, or one per sales org or country?
**Decision taken:** one order (`RuleCampaign/Order`, no parameter). The page reads and saves the DRAFT order, which publishes with the next version.
**Why:** the prototype and ADR 0090 describe one tree.
**Revisit if:** 2759 scopes the order (by country, sales org or store). Then the door takes a key and the page gets a picker.

## Q: What happens to a campaign that is not in the order (for example, one just created)?
**Decision taken:** the page draws only what HQ's order holds. HQ is assumed to place a new campaign itself, at the end of the base, as the prototype does on create and copy.
**Why:** the client never mints placement for HQ, and adding an unplaced bucket would mean guessing the contract.
**Revisit if:** 2759 leaves new campaigns unplaced. Then add a "Not in the order yet" list with "Add to the base". Related: a save sends the whole order, so a campaign HQ added while the reader was editing would be overwritten unless HQ merges (ask 2759 for a row version or a merge).

## Q: Who mints a new group's id, and is its name bilingual?
**Decision taken:** the client mints a temporary `new-N` id, and HQ may re-key it on save (the page reads HQ's answer). The name is plain text, not an {en, ar} pair.
**Why:** a group name is back-office only. It never reaches a receipt or a cashier, so it is not on the wave's EN + AR list.
**Revisit if:** 2759 wants group names bilingual, or mints ids before the first save.

## Q: Does up / down step a campaign out of a group?
**Decision taken:** no. Up / down moves within the campaign's own list, a group moves as one place in the base, and "Move to" moves between places (it appends at the end). This is the prototype's behaviour.
**Why:** the ticket's "up / down within and between them" is met by up / down plus Move to, with no drag-and-drop.
**Revisit if:** the owner wants up at the top of a group to step out into the base.

## Q: What are a new group's defaults, and what else did the page take from the prototype?
**Decision taken:** a new group is "first that yields", session scope, empty, named "New group N" (a name no group has). Also from the prototype: an empty group can be deleted (one with campaigns cannot), the mode legend, Discard, and a guard on leaving with unsaved changes. A blank group name holds the save.
**Why:** these are the prototype's defaults. The client does not enforce "item scope holds only item discounts" (ADR 0090); HQ refuses that on save, and the refusal is shown with its own message.
**Revisit if:** 2759 validates other rules client-side, or the owner wants different defaults.

## Q: An untidy order from HQ (a campaign twice, a group placed twice or not at all)?
**Decision taken:** the page draws it tidy (`tidyOrder`): each campaign in its first place, each group placed once, and an unplaced group added at the end of the base. A save sends what is drawn.
**Why:** otherwise rows have duplicate keys, or a campaign moved into an unplaced group disappears.
**Revisit if:** 2759 guarantees a tidy order. Then `tidyOrder` is harmless and can stay.

## Note: provisional wire names
`{c}` / `{g}` and `'base'` as the place name come from the prototype. A group with the id `"base"` would collide with the base. 520 should take HQ's real names.

## Note: LeaveGuard graduated to core
`src/core/ui/LeaveGuard.tsx` now takes already-translated words. The workspace's `LeaveGuard.tsx` is a thin wrapper in its own namespace (505 and 509 are unchanged), and Priority uses the core one directly. The campaigns drive still passes in full (450/450).
