---
status: done
spec: BackOffice 4354
blocked-by: BO 4355, BO 4356, BO 4357
---

# 962 — Tracer: the simulator builds a cart, runs it, and shows the plans as cards or as one table

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- A new page under OMS: the workbench. Left column: start a run. Right: the plans.
- Build a cart: lines (item, quantity), the channel, the time of day, and the customer placed by a click on the map panel (the panel gains "a click places the customer"). It runs on the Run button, not on every change.
- It calls the user's route at the full level with `allPlans`. One "planning" state; stage times are read from the reply. An error is shown by its code with text in both languages ("The stock figures could not be read" offers "try again").
- Plans as cards, or by a switch one table with a row per measure and a column per plan. Merged plans carry tags ("Recommended · also fewest deliveries"). A goal with no plan and each hidden plan are listed under the plans with the reason, hidden ones behind a "show" link. A banner when the simple plan answered, and the run's ending in words.
- Each plan shows the customer's fee per shipment and total, the company's cost, the price of waiting and the balanced total, and the server's promise sentence.
- The page opens under the run grant. English and Arabic; desktop width. Structure to copy: the campaign simulator page. The prototype `.scratch/proto/4241-sourcing-simulator` in BackOffice is the look.

## Spine reach

oms-react: wire models / page / map panel / locales / tests

## Proof (→ `tdd` red-green cycles)

- [x] `plans-table-model.test.ts` — a real reply of the door gives the rows per measure and the columns per plan, with tags · vitest (`npm test`)
- [x] `plans-list-model.test.ts` — goals with no plan and hidden plans are listed with their reason · vitest (`npm test`)
- [x] `error-text.test.ts` — every door error code has English and Arabic text · vitest (`npm test`)
- [x] `map-place-customer.test.ts` — a click on the panel places the customer · vitest (`npm test`)
- [x] `tools/sourcing-simulator-drive.mjs` — build a cart, run, switch cards to table, in English and in Arabic (right to left) · Playwright drive, run by hand against stubs

## Boundaries

New page behind the run grant. Can start on a stubbed reply before the BackOffice tickets land; reconcile to the real wire when they do.

## Done when

The model tests are green and the drive passes in both languages against stubs.

## Blocked by

BackOffice 4355 (`.issues/4355-a-hand-built-cart-gets-a-recommended-plan-from-the-users-route.md`),
BackOffice 4356 (`.issues/4356-the-five-plan-goals-the-rules-of-the-search-and-the-tie-breaks-give-the-same-plans-twice-and-cp.md`),
BackOffice 4357 (`.issues/4357-the-simple-plan-the-four-endings-the-work-budget-and-the-plans-shown.md`)

## Comments

**2026-11-27 — built on stubs (done in oms-react; reconcile when BackOffice 4355–4357 land).** The advise door does not
exist yet. The page, the models and the drive are built against BackOffice 4281's worked example, cut to the full
level: `src/features/oms/sourcing-simulator/advise-reply.fixture.json`, read by both the model tests and the drive's
stub. When BO 4355 (route, `ADVISE-503`/`ADVISE-512`, run grant), BO 4356 (five goals) and BO 4357 (endings,
`alsoGoals`, hidden codes, `noPlan[]`) land, replace the fixture with a captured reply, run the four model tests and the
drive, and settle each provisional name below. The BO blockers stay listed for that reason.

What was built:
- Wire types in `src/core/models/sourcing-run.ts` (4281 request and reply; 963–966 extend them). The simulator's route
  and the stored-run link 971 needs: `src/core/sourcing-advisor/simulator-path.ts` (`SIMULATOR_PATH`,
  `simulatorRunPath(runId)`; the page does not read `?run=` yet — that needs the stored-run read door).
- The map panel gains "a click places the customer": `MapEngineEvents.tap(target, zoom, place?)`, `markerHits.mapClick(place?)`,
  Google's `click` hands `latLng` on, and the panel's `onPlace` prop (`map-panel.ts`, `map-markers.ts`,
  `google-engine.ts`, `MapPanel.tsx`; tests `map-place-customer.test.ts` + two cases in `google-engine.test.ts`).
- Feature `src/features/oms/sourcing-simulator/` (namespace `sourcing-simulator`, EN + AR), route `/oms/sourcing-simulator`,
  menu leaf after Sourcing advisor (`menu-model.test.ts` pins it). Today's `features/oms/sourcing-advisor` is untouched.
- No hand-written controls (core `Button`/`Input`/`Select`/`Chip` only), so no control-baseline lines; no new colours.

PROVISIONAL (spec 4354: not specified) — every name invented, each marked so in the code:
- Run grant key `SourcingAdvisorRun:06` (`SCREEN_KEYS`), read by `canRunSourcingAdvisor` in `src/core/sourcing-advisor/access.ts`.
- `plans[].sum` field names `{ companyCost, fees, waiting, cover, split, total }` (4281 names the parts in words only).
- `hiddenPlans[].plan` — where `allPlans` puts the hidden plan itself (4281: "each also holds the plan itself").
- `GET SourcingAdvisor/Workbench` → `{ maps: { key, mapId? } }` — a source for Google's key (none is decided; the advise
  reply carries no `maps` part). Without a key the map says it cannot draw and the point is typed.
- Channel code `CALL_CENTRE` for "a call-centre source" (`SIMULATOR_CHANNELS` in `cart.ts`).
- Line unit `EA` on every hand-built line (`LINE_UNIT`; no unit picker is specified).

Other choices to confirm: items are typed as codes (no item search door is named); "company's net" is not a row (no
field carries it and no reader may compute it, 4281 decision 28); "try again" is offered on `ADVISE-429/500/503/504/511/512/513`.

Proof as run: `npm test` (970 files), `npm run typecheck`, `npm run lint` green; `tools/sourcing-simulator-drive.mjs`
64/64 on Edge (`PLAYWRIGHT_CHANNEL=msedge`), LTR and RTL. ⚠ The OMS app boots i18next in English and `oms.locale = 'ar'`
sets only the direction, so the RTL pass reads English words; the Arabic text of every key, and every door error code's
Arabic, is pinned by `error-text.test.ts`. The click on a real Google map needs a real key, so the drive types the point
and the click is proven by `map-place-customer.test.ts`.
