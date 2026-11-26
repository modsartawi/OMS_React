---
status: open
spec: BackOffice 4354
blocked-by: 962, BO 4359, BO 4360
---

# 963 — Pins and the weight set panel: pin from a plan, change values on a draft, save as a named set

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Pins panel: "never this store", "never this mode", "everything in one shipment"; pins shown as chips; a refused pin stays listed with its reason. On a plan each line has "pin store" and "pin mode", and each shipment "never this store".
- With pins on, every plan shows what the pins cost it in minutes, riyals and deliveries, from the run without pins the reply carries. Pins that leave no plan: one banner naming them.
- Weight set panel: a picker of named sets and versions, a "changed, not saved" mark, "Save as a named set"; then Weights (sliders), Factors (switches), Reach and shape (switches), with the switch fee per shipment or one fee per order. There is no switch for pricing waiting on each shipment.
- Unsaved values go to the door as a draft, in full. A changed weight or pin plans again on the same figures (`basedOnRun`); when the held copy is gone after 30 minutes the cart runs again; a change that needs a wider read is read afresh and the screen says so.
- A banner on a trial set. Saving needs the save grant.

## Spine reach

oms-react: page / models / locales / tests

## Proof (→ `tdd` red-green cycles)

- [ ] `pins-model.test.ts` — chips, refused pins with reasons, and the cost of the pins per plan · vitest (`npm test`)
- [ ] `draft-model.test.ts` — a changed value makes a full draft and marks "changed, not saved" · vitest (`npm test`)
- [ ] `replan-model.test.ts` — a changed weight asks for `basedOnRun`; a 404 runs the cart again; `READ_AFRESH` is said · vitest (`npm test`)
- [ ] `tools/sourcing-simulator-drive.mjs` — pin a line, change a weight, save as a named set · Playwright drive, run by hand against stubs

## Boundaries

—

## Done when

The model tests are green and the drive passes.

## Blocked by

[962](962-the-simulator-builds-a-cart-runs-it-and-shows-the-plans-as-cards-or-as-one-table.md),
BackOffice 4359 (`.issues/4359-pins-hold-on-every-goal-a-pin-that-cannot-hold-is-refused-and-the-run-without-pins-is-kept-besid.md`),
BackOffice 4360 (`.issues/4360-weight-sets-are-saved-as-numbered-versions-a-draft-runs-unsaved-and-the-candidate-set-is-marked.md`)
