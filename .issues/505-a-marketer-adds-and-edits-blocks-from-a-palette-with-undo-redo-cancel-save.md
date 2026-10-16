---
status: open
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

- [ ] `builderHistory_undoRedo_andCancelRestoresSaved` · pure
- [ ] `palette_gatesPointsAndCouponBlocks_byFeature_andHidesNotDecided` · pure
- [ ] drive: add a condition from the palette, edit it in the panel, Done, Undo, Redo, Save (stubbed) · flow

## Boundaries

Provisional draft-save endpoint (BackOffice 2758), stubbed. No item picker here (506), and formulas stay read-only
sentences until 507.

## Done when

A rule can be built from the palette, edited, undone and saved in the drive.

## Blocked by

[504](504-the-rule-builder-reads-each-rule-as-sentences.md)
