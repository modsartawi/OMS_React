---
status: done
spec: BackOffice 4354
blocked-by: BO 4381
---

# 964 — A replay shows what happened beside the plans, and the map shows every plan's stores

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Start a run by replaying an order: the order number, then its lines, channel and time. A replay on today's figures says so on screen: "planned on today's figures, not the order's".
- "What happened": a dashed card, or the table's last column: the store and mode routing chose, when it was delivered, late or not, the fee, and one sentence against the Recommended plan.
- The map tab, on the Google map panel: every plan's stores at once, coloured by mode, the pick-up leg dashed, each labelled with its distance to the customer; a switch narrows to the selected plan; a dotted line joins one plan's stores. Two tables under it: each store with its mode, plan, road and straight-line distance; and the distances between the stores. The panel gains a dashed line and the 5 km and 10 km rings.
- The customer's pin can be moved (click places, drag moves), in a replay too: the run plans again on the drop, the replay is marked "customer's point moved by hand" and "What happened" is hidden until "Back to the order's point".
- The customer-point switch sends `withCustomerPoint`. Without the grant a replay shows no pin, rings or legs, says why the point was withheld, and every km stays exact.

## Spine reach

oms-react: page / map panel / models / locales / tests

## Proof (→ `tdd` red-green cycles)

- [x] `what-happened-model.test.ts` — the card's facts and its one sentence from a replay reply · vitest (`npm test`)
- [x] `map-plans-model.test.ts` — stores by mode, the two tables, and nothing drawn when the point is withheld · vitest (`npm test`)
- [x] `map-drawing.test.ts` — a dashed line and the two rings · vitest (`npm test`)
- [x] `tools/sourcing-simulator-drive.mjs` — replay an order, open the map, move the pin, go back · Playwright drive, run by hand against stubs

## Boundaries

—

## Done when

The model tests are green and the drive passes.

## Blocked by

[962](962-the-simulator-builds-a-cart-runs-it-and-shows-the-plans-as-cards-or-as-one-table.md),
BackOffice 4381 (`.issues/4381-a-user-replays-an-order-its-own-quantities-are-added-back-and-the-customers-point-shows-only-und.md`)

## Comments

**2026-11-27 — built on stubs (done in oms-react; reconcile with BackOffice 4381 when it lands).** The advise door's
replay does not exist yet. Everything is built against a stub of a replay reply,
`src/features/oms/sourcing-simulator/replay-reply.fixture.json` (4281's worked example made a replay, with "what
happened" in the shape below), read by both model tests and the drive. When BO 4381 lands, replace the fixture with a
captured reply, rename the provisional fields below, and run the model tests and the drive again. BO 4381 stays listed
as the blocker for that reason.

What was built:
- The map panel (`src/core/map/`): a line may be `dash: 'dashed' | 'dotted'` (Google strokes a hidden polyline with a
  short stroke of its colour repeated along it, `lineStroke`); `rings` (`MapRing`, a closed dashed path round a centre
  at a distance on the ground, `ringPath` and `kmBetween`, its words at its top, not in the fitted view); a customer
  `pin` (`MapPin`, a diamond above every store, in the fit) that a drag moves (`pinDrag`, pure: no drag under 4 px,
  nothing told while dragging, the drop told once through `onPinMoved`; the map's own click after a drop places
  nothing). Tests: `map-drawing.test.ts` (dashes, rings, ground distance), `map-place-customer.test.ts` (pin and drag),
  `google-engine.test.ts` (polyline icons, ring polylines and words, the pin element's pointer drag). Maps before 964 are
  handed exactly what they were (`map-lines.test.ts` unchanged).
- Feature: "Replay an order" / "Build a cart" switch in `CartPanel.tsx` (`ReplayStart.tsx`, `replay.ts`), the
  "planned on today's figures, not the order's" banner with "customer's point moved by hand" and "Back to the order's
  point" (`ReplayBanner.tsx`), "What happened" as a dashed card and as the table's last column
  (`what-happened-model.ts`, `WhatHappenedCard.tsx`), and the `map` tab (`map-plans-model.ts`, `MapTab.tsx`, registered in
  `SimulatorTabs.tsx`). The map tab moves the customer through `run-context.ts`; the page plans again on the drop, a
  cart's point or a replay's point placed by hand.
- Colours: `--map-mode-dawaa-now`, `--map-mode-slot`, `--map-mode-carrier`, `--map-mode-pick-up`, `--map-customer`
  (`src/app/global.css`, held at 3:1 on `--card` by `tools/check-contrast.mjs`). No hand-written control besides a
  checkbox (not counted), so no control-baseline line. Locale sections `replay`, `whatHappened`, `map`, EN and AR.

PROVISIONAL (spec 4354: not specified) — every name invented, each marked so in `src/core/models/sourcing-run.ts`:
- `whatHappened` on the reply, with `placedAt`, `deliveries[]` (`delivery`, `store`, `storeName`, `mode`, `promisedBy`,
  `deliveredAt`, `late`, `minutesLate`, `fee`) and `totals` (`deliveries`, `fee`). 4381 says only "the store and mode
  routing chose, when it was delivered, late or not, the fee". `placedAt` is needed for the one sentence: a replay plans
  on today's figures, so the plan's promise is read as minutes from planning and the order's as minutes from being
  placed to its last delivery.
- No customer-point grant key in the client. The switch (`withCustomerPoint`) is offered to every user, and the server
  withholds the point and says why (`customerPointWithheld`). A reply with no point and no reason reads as `NOT_ASKED`,
  a client-side word, not a wire code.

Other choices to confirm: the replay request is `{ orderNumber, level: 'full', allPlans: true, withCustomerPoint }`
(+ `customer.point` when moved, + 963's `pins` and `weightSet` as a cart carries them, through `replan-model.ts`'s
`cartRequest`; 4281 decision 11 says "`orderNumber` alone"), with no `plannedFor` (4244 decision 17's hour of a replay is not offered yet). The
straight line to the customer and the distance between two stores are worked out from the points (great circle), since
4281 sends one km per store. The order's lines, channel and time are shown from the reply after Run, because no order
read door is named. The legend, the map's labels and a moved point's typed fallback are ours.

Proof as run (after merging 963, 965, 966 and 973 from the spec branch): `npm test` (993 files, 12 + 13 new model tests, 10 + 9 + 9 new map tests), `npm run typecheck`,
`npm run lint` green. `tools/sourcing-simulator-drive.mjs` 222/222 on Edge (`PLAYWRIGHT_CHANNEL=msedge`), LTR and RTL
(18 replay checks in each direction beside 962's, 963's and 965's). Google's map needs a real key, so the drive types the moved
point (the map's "cannot draw" fallback, "Plan from this point"). The click, the drag and the drawing are proven by the
vitest tests above. As in 962, the RTL pass reads English words: `oms.locale = 'ar'` sets only the direction.
