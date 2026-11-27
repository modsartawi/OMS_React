---
status: done
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

- [x] `pins-model.test.ts` — chips, refused pins with reasons, and the cost of the pins per plan · vitest (`npm test`)
- [x] `draft-model.test.ts` — a changed value makes a full draft and marks "changed, not saved" · vitest (`npm test`)
- [x] `replan-model.test.ts` — a changed weight asks for `basedOnRun`; a 404 runs the cart again; `READ_AFRESH` is said · vitest (`npm test`)
- [x] `tools/sourcing-simulator-drive.mjs` — pin a line, change a weight, save as a named set · Playwright drive, run by hand against stubs

## Boundaries

—

## Done when

The model tests are green and the drive passes.

## Blocked by

[962](962-the-simulator-builds-a-cart-runs-it-and-shows-the-plans-as-cards-or-as-one-table.md),
BackOffice 4359 (`.issues/4359-pins-hold-on-every-goal-a-pin-that-cannot-hold-is-refused-and-the-run-without-pins-is-kept-besid.md`),
BackOffice 4360 (`.issues/4360-weight-sets-are-saved-as-numbered-versions-a-draft-runs-unsaved-and-the-candidate-set-is-marked.md`)

## Comments

**2026-11-27 — built on stubs (done in oms-react; reconcile when BackOffice 4359 and 4360 land).** Neither the pins on
the advise door nor the weight-set doors exist yet. The page, the models and the drive are built against BackOffice
4281's wire (decisions 13, 15, 16, 24; its refused-pin example) and stubs of the weight-set doors 4360 names without
paths: `src/features/oms/sourcing-simulator/pins-reply.fixture.json` (the pins, the refused pin, the run without pins) is
read by both `pins-model.test.ts` and the drive. When BO 4359 and BO 4360 land, replace the fixture with a captured
reply, settle each provisional name below, and run the three model tests and the drive. The BO blockers stay listed
for that reason.

What was built:
- Wire types in `src/core/models/sourcing-run.ts`: `AdvisePin` (the five kinds), `AdviseWeightSetRef` (saved version or
  draft in full), `AdviseRerunRequest` (`basedOnRun`), `AdviseRefusedPin`, `AdviseWithoutPins`, and the weight-set door
  types `WeightSetListItem`, `WeightSetVersion`, `WeightSetSaveRequest`.
- Pure models: `pins-model.ts` (chips with refusals, add/remove, what the pins cost each plan, the clash banner, the
  stores "never this store" offers), `draft-model.ts` (the panel's controls, a full draft, "changed, not saved", the save
  body), `replan-model.ts` (what Run sends: the cart, or `basedOnRun` when only pins or the set changed; a 404 runs the
  cart again; what the run stands on).
- UI: `PinsPanel.tsx`, `WeightSetPanel.tsx` (left column, under the cart), `PlanPins.tsx` (pin buttons on each shipment
  and line, the pins' cost on each card and as a table row), `RunBasisNotes.tsx` (trial banner, draft, "figures as read
  at … from run …", read afresh, held copy gone, the clash banner), `Toggle.tsx`. There is no switch for pricing waiting
  on each shipment (spec Further Notes).
- Locale sections `pins`, `weights`, `replan` in `src/locales/{en,ar}/sourcing-simulator.json`.
- One control-baseline line: the range slider in `WeightSetPanel.tsx` (no shared range control in `core/ui`).

PROVISIONAL (spec 4354: not specified), each marked so in the code:
- Save grant: "Save as a named set" reads 973's one provisional save grant, `canSaveWeightSets` (`SourcingAdvisorSave:01`)
  in `src/core/sourcing-advisor/access.ts`; 963's own second key was dropped at the merge so there is a single save grant.
- Weight-set doors: `GET SourcingAdvisor/WeightSets` → `WeightSetListItem[] { name, owner, versions, candidateVersion,
  trial }`; `GET SourcingAdvisor/WeightSets/Version?name=&version=` → `{ name, version, values, candidate, trial }`;
  `POST SourcingAdvisor/WeightSets/Save` with `{ name, basedOn, values }` → `{ name, version }`.
- Keys inside a set's `values` the panel edits: `companyCostWeight`, `feeWeight`, `waitingPerHour`, `splitPenalty`,
  `mostShipments`, `marginMultiplier`, `buffer`, `stockConfidence`, `storeRecord`, `widerSlotReach`, `carrierModes`,
  `feePerOrder`, `pickUpInDeliveryPlan` (`WEIGHT_CONTROLS` in `draft-model.ts`; ranges from the prototype, starting values
  from BO 4243 decision 19). Every other key of a version is carried as read, so the draft is always the whole set.
- `refusedPins[].pins` — the pins of a `PINS_CLASH` (4281: "the pins and the rule they break", no field name).
- `solve.readAfreshWhy` — the why beside `READ_AFRESH` (4281 gives it no field).

Other choices to confirm: "what the pins cost" shows minutes (the last promise time), the customer's fee and the
company's cost as two differences, and deliveries — no riyal total is made (4281 decision 28); a pin added after a run
is not sent until Run; the picker opens on the candidate set's marked version; Run with nothing changed reads afresh.

Proof as run (after merging the spec tip with 965 and 973): `npm test` (987 files), `npm run typecheck`, `npm run lint` green; `tools/sourcing-simulator-drive.mjs`
144/144 on Edge (`PLAYWRIGHT_CHANNEL=msedge`), LTR and RTL (962's and 965's checks plus 21 for this ticket per direction). As in
962, the RTL pass reads English words (the app boots i18next in English); the Arabic keys exist for every new key.
