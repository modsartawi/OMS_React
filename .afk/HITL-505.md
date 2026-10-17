# HITL — ticket 505 (palette, panel, Undo / Redo / Cancel / Save)

I re-read the brief at the start of 505. It still has **no contract section**, so the draft-save door is the runner's provisional one: `PUT RuleCampaign/Campaigns/{id}/Draft` with `{ rules }`, and HQ answers with the whole campaign.

## Q: What does Save send, and to which door?
**Decision taken:** Save sends only the rules (`{ rules }`) to `PUT …/{id}/Draft`. HQ answers with the whole campaign, which replaces the cached copy. Settings (509) can save their own parts later.
**Why:** The ticket says "Save saves the draft", and this page edits only the rules.
**Revisit if:** 2758 wants the whole campaign per save, or a version token for concurrency (there is none now, so the last save wins).

## Q: May a live or waiting-for-approval campaign be edited?
**Decision taken:** The builder is editable for every state. HQ decides, and its refusal shows as the door's own message, with the edits kept.
**Why:** A live campaign's edits are a working draft that is published later (2759). The prototype also lets every campaign be edited.
**Revisit if:** The owner wants a waiting campaign read-only in the client.

## Q: Which blocks may the palette offer?
**Decision taken:** It offers only decided blocks whose feature is on. A feature that is off is named in a line under the palette ("Coupon blocks appear once …"). Blocks are left out, not greyed, as the ticket says.
**Why:** The ticket says "shows only the blocks the campaign's features switch on … leaves out blocks the catalogue marks not decided". The prototype greys them out.
**Revisit if:** The owner prefers the prototype's greyed items with a reason.

## Q: Is the Formula (advanced) condition offered before 507?
**Decision taken:** No. A block with a `formula` field (`expr`) is left out of the palette until 507 (`NOT_YET_EDITABLE` in `workspace/palette.ts`). An existing one still reads, shows its formula read-only in its panel, can have its "not met" pair edited, and can be deleted.
**Why:** "formulas stay read-only sentences until 507". An `expr` added now would have an empty formula that nothing can fill in.
**Revisit if:** 507 lands; it should then empty `NOT_YET_EDITABLE`.

## Q: How does a discount or points field refer to a named value?
**Decision taken:** A select offers "a number" or one of the rule's named values. A pick stores the value's **id**. An existing reference by name (the samples' `'back'`) still reads and selects correctly, because `sentence.ts` resolves it by id or by name.
**Why:** It follows the ruling that filters are referenced by id, so a rename (507) never breaks a rule.
**Revisit if:** 2758 settles named-value references by name.

## Q: What does a new block start with?
**Decision taken:** Each catalogue field starts empty by its kind:
- a choice takes its default, or else its first option;
- a number is unset, so the sentence reads "not picked yet";
- an items field starts at all merchandise for a condition, and at the rule's first filter for an effect (as the prototype does);
- timing is "not set";
- an EN + AR pair is empty.

The panel opens straight away.
**Why:** The prototype hand-wrote sample numbers for each type (100, 2, 10 …). A client-side guess like that would spread the catalogue's knowledge into the client.
**Revisit if:** 2758's catalogue carries defaults for each field (the `default` field is already read).

## Q: What counts as one Undo step?
**Decision taken:** One edit is one step, except typing: keystrokes into one field are a single step until the panel opens or closes. The two halves of an EN + AR pair count as one field. Undo goes back at most 100 steps. Save and Cancel clear the history, as in the prototype.
**Why:** A step for every keystroke would make Undo useless.
**Revisit if:** The owner wants keyboard Undo (Ctrl+Z), which would clash with each input's own Undo.

## Q: Where do new rule and block ids come from?
**Decision taken:** The browser mints them with `mintRequestId` (a UUID, with a fallback for the http-served host), and they are saved as they are.
**Why:** The provisional wire has no "new block" marker, and the samples carry ids already.
**Revisit if:** 2758 wants HQ to mint ids and the client to send new blocks without one.

## Q: What is in scope beyond the ticket's list?
**Decision taken:** These are built:
- the all / any select for the When and for each group;
- the points-shortfall select (refuse / scale), which the prototype has under a `burnPoints`;
- a Delete button inside the panel;
- an "Unsaved changes" pill.

Filters (506) and named values (507) stay read-only.
**Why:** The prototype's builder has all of these, and without the all / any choice a group cannot be edited.
**Revisit if:** The owner wants 505 trimmed to the ticket's list.

## Note: block types still incomplete
**Every** catalogue block type has a panel. None is half-wired. The exceptions belong to other tickets:
- the formula field is read-only (507);
- the items field picks among the rule's existing filters only, and "Certain items…" is 506's picker;
- `code` fields (a value map, a SKU, a coupon campaign) are free-text codes until the lookups (506 / 2758) exist.
