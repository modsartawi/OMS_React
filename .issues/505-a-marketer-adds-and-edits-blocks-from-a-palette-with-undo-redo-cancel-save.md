---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 504
---

# 505 — A marketer adds and edits blocks from a palette, with Undo / Redo / Cancel / Save

## What to build

The builder becomes editable. **+ Condition / + Effect** opens the **palette**, grouped by category. It shows only the blocks
the campaign's **features** switch on (points blocks only with points, coupon blocks only with coupons) and leaves out blocks the
catalogue marks "not decided". Clicking a sentence opens its **panel**, a typed form per field and unit, closed
with **Done**. A marketer can add, rename, reorder and delete rules, and reorder and delete blocks. The page has **Undo / Redo / Cancel / Save**
(Save saves the draft). Leaving with unsaved changes asks first. "Not met" messages (conditions), receipt
labels (discounts) and cashier messages are **EN + AR** pairs in the panel.

The edit history is a pure reducer (`builder-history.ts`: past / present / future), which keeps the component thin.

## Spine reach

model/api (`saveDraft`) · logic (reducer, palette gating) · component (palette, panel) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `builderHistory_undoRedo_andCancelRestoresSaved` · pure
- [x] `palette_gatesPointsAndCouponBlocks_byFeature_andHidesNotDecided` · pure
- [x] drive: add a condition from the palette, edit it in the panel, Done, Undo, Redo, Save (stubbed) · flow

## Boundaries

Provisional draft-save endpoint (BackOffice 2758), stubbed. No item picker here (506), and formulas stay read-only
sentences until 507.

## Done when

A rule can be built from the palette, edited, undone and saved in the drive.

## Blocked by

[504](504-the-rule-builder-reads-each-rule-as-sentences.md)

## As built

- **Model / api (PROVISIONAL):** `RuleCampaignDraft = { rules }` in `core/models/rule-campaign.ts`. The door is `PUT RuleCampaign/Campaigns/{id}/Draft` (`ruleCampaignApi.saveDraft`), and HQ answers with the whole campaign. `rememberSavedDraft` puts that answer into the campaign's query and re-reads the list.
- **Logic (pure, all in `features/campaigns/workspace/`):**
  - `builder-history.ts` holds past / present / future beside the saved rules. It has edit, undo, redo, cancel, saved, load and seal. Typing into one field is one Undo step, and opening or closing a panel seals that step. An edit made while a save is in flight is kept. A re-read from HQ never drops unsaved edits. The history keeps at most 100 steps.
  - `rule-edit.ts` holds the edits by id: add, rename, move and delete rules; add, set a field, move and delete blocks, inside groups at any depth; the all / any choice; the points-shortfall choice. An edit copies only what it changes, and one that changes nothing returns the same rules.
  - `palette.ts`:
    - `paletteFor` keeps the catalogue's groups in order. It drops undecided blocks, blocks whose feature is off, and blocks with a formula field (until 507).
    - It names the features that are off, so the palette can say where those blocks are.
    - `newBlock` and `newRule` make empty blocks and rules. An effect's items field starts on the rule's first filter, by id.
  - `panel-keys.ts` finds the label keys.
- **Screen:**
  - `RulesPage` holds the reducer. Its bar has Undo / Redo / Cancel / Save and an "Unsaved changes" pill. A refused save shows the door's own message in a banner, and the edits are kept.
  - `useBlocker` with a Modal (Stay / Leave and discard) asks before leaving with unsaved changes, and `beforeunload` covers closing the tab.
  - `RuleCard` has a name input, up / down / delete for each rule and each block, and an all / any select.
  - A group has its own palette. A sentence is a button that opens its panel, which closes with Done.
  - `BlockPanel` gives each field kind a typed control:
    - items as the rule's filters by id;
    - bundle parts;
    - money with its currency;
    - count and days;
    - a discount or points value as a number or a named value;
    - codes, comma-separated;
    - choice and choices;
    - timing (a local date, never a `Z`);
    - budget and flag.
  - In the panel, a formula is shown read-only (507 adds the editor). Each EN + AR pair is two inputs, the Arabic one `dir="rtl"`.
  - `PaletteMenu` places the palette in the page. Focus moves into it, and Escape or Close returns focus to the button.
- **Proof:**
  - vitest: `builder-history.test.ts` (8), `palette.test.ts` (6), `rule-edit.test.ts` (4) and `panel-keys.test.ts` (3). The panel-keys tests check that every catalogue block, group, field and choice has words.
  - `tools/campaigns-drive.mjs` passes 184/184, stubbed. 505's checks are 24–33. 504's check 17 now reads the rule name from its input.
- **Gates:** typecheck, `npm test` (5309), lint (4 gates) and build are all green.
- **Outstanding (not AFK's):**
  - Owner sign-off on the rulings in `.afk/HITL-505.md`.
  - Someone needs to look at the EN + AR inputs under Arabic.
  - The live draft-save door belongs to 520.

