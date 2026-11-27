---
status: done
spec: BackOffice 4354
blocked-by: 962, BO 4373, BO 4380
---

# 969 — The store record list and kept runs

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Start with a quick prototype shown to the owner (HITL).
- A read-only store record list of every pair: per measure the store's rate, the like-store rate, the deliveries behind it, its cost or credit, and a mark when it ran on the neutral default; the counted-from date; the callout fallback count; the channels each measure counted; the usual slot and regular slot hours; the store's share of till moves marked "Customer" beside like stores'; and what is "shown, not charged" (the last count, the count factor, a donor's refusals).
- The wording is "how deliveries go at this store". "Ready late" reads "ready after 30 minutes".
- Kept runs: keep and name a run from the simulator, a list of kept runs, open one by its link, delete one's own.

## Spine reach

oms-react: pages / models / locales / tests

## Proof (→ `tdd` red-green cycles)

- [x] `store-record-model.test.ts` — the rows per measure with the neutral-default mark and the channels counted · vitest (`npm test`)
- [x] `kept-runs-model.test.ts` — the list and what a link opens · vitest (`npm test`)
- [x] `tools/sourcing-record-drive.mjs` — open the list, keep a run, open it by link · Playwright drive, run by hand against stubs

## Boundaries

HITL prototype first. Read-only list.

## Done when

The owner has seen the prototype; the model tests are green and the drive passes.

## Blocked by

[962](962-the-simulator-builds-a-cart-runs-it-and-shows-the-plans-as-cards-or-as-one-table.md),
BackOffice 4373 (`.issues/4373-the-store-record-is-rebuilt-each-night-per-pair-on-the-counted-channels-with-one-bad-ending-per.md`),
BackOffice 4380 (`.issues/4380-every-run-is-held-an-earlier-run-is-planned-again-on-the-same-figures-and-a-user-keeps-a-run-by.md`)

## Comments

Owner decision 2026-11-27 on the prototype (branch `prototype/4354-secondary-screens`, route `/oms/prototype-sourcing-record`): **variant C**. One tab per mode. The like-store rates, counted-from date and channels are said once per mode, with a row per store below. A kept run's link opens the simulator straight away.

**2026-11-27 — done on stubs; must be reconciled with BO 4373 and BO 4380 (both still open).** By the orchestrator's
ruling the screens are built on a designed wire and drive stubs. Every invented door, field and grant carries
`// PROVISIONAL (spec 4354: not specified)` in the code. When the BackOffice tickets land, change these to match:

- Store record door (BO 4373), `src/features/oms/sourcing-record/api.ts`: `GET SourcingAdvisor/StoreRecord`. Reply
  (`src/core/models/sourcing-store-record.ts`): `StoreRecordReply { builtAt, windowFrom, windowTo, pairs[], shown[] }`
  (`builtAt: null` = never built); `StoreRecordPair { store, storeName, mode, band, deliveries, countedFrom,
  fallbackLeftOut, cost, measures[], slot { usual, regularHours[{ from, to }] }, tillMoves { customerShare, likeStores,
  moves } }`; `StoreRecordMeasure { measure, rate, ownRate, likeStores, count, bad, price, cost, neutral, channels[] }`;
  `StoreRecordShown { store, lastCount, countFactor, donorRefusals }`. Codes: bands `UNDER_30|FROM_30|FROM_100|FROM_300`;
  neutral reasons `NO_DELIVERIES|NO_RECORD|SWITCHED_OFF`; measure keys `late`, `returned`, `cancelled`,
  `neverMadeReady`, `readyLate`, `calloutIgnored`; channels `APP`, `SITE`, `CALL_CENTRE`.
- Kept-run doors (BO 4380), `src/features/oms/sourcing-simulator/api.ts`: `POST SourcingAdvisor/Runs/Keep { runId, name }`
  → `KeptRun` (a run no longer held answers `ADVISE-404`); `GET SourcingAdvisor/Runs/Kept` → `KeptRun[]`;
  `DELETE SourcingAdvisor/Runs/Kept?runId=`; `GET SourcingAdvisor/Runs/Open?runId=` → `StoredRun { state, kept, record,
  engineNow }` (the stored-run read door of BO 4281 decision 11; a run not there answers `ADVISE-404`). Types in
  `src/core/models/sourcing-run.ts`: `KeptRun { runId, name, keptBy, mine, keptAt, ranAt, kind, channel, orderNumber,
  weightSet { name, version, draft }, engine }`, `KeepRunRequest`, `StoredRunState` (`HELD|COMPARISON|KEPT`),
  `StoredRun`. A kept run's name takes at most 80 characters (`KEPT_NAME_MAX`).
- Grant: none new. The run grant `SourcingAdvisorRun:06` (962's provisional key) opens the store record list and kept
  runs (spec §19).

Built: the store record list as the owner's variant C. Feature `src/features/oms/sourcing-record/` (route
`/oms/sourcing-record`, menu leaf "Store record" after the Sourcing simulator, namespace `sourcing-record` en + ar).
A tab per mode, kept in the URL as `?mode=`. The counted-from date, the channels per measure and the like-store rate
per band are said once per mode. Below them, a row per store: rate, like stores, bad endings / deliveries, cost or
credit, the neutral-default mark with its reason, the record cost, the callout fallback left out, slot delivery's
usual slot, regular hours and till moves marked "Customer", and "shown, not charged". The carrier modes are listed as
keeping no record. Plain tables, no grid.

Kept runs live in the simulator's feature, which keeps, lists and opens them (features never import features).
"Keep and name this run" sits under the run summary (`KeepRun.tsx`). The list is at `/oms/sourcing-simulator/kept`
(`KeptRunsPage.tsx`, `KEPT_RUNS_PATH` in `src/core/sourcing-advisor/simulator-path.ts`), with open, copy link and
delete (own runs, confirmed first). It shows the caller's own runs only: §12 says nothing of listing another keeper's,
so those open by their link. A run's link is `simulatorRunPath` (`/oms/sourcing-simulator?run=<id>`). The simulator
reads it through the stored-run door and shows the stored plans at once, with the run's name, keeper and engine, and
"a newer engine answers differently" when it does. The run's cart (never the customer's point) or order is set back on
the left. A changed pin or weight then plans again on its figures (`basedOnRun`), and a run made from there drops
`?run=`. `SIMULATOR_READS_RUN` is on, so the results page's "Open the stored run in the simulator" shows again for
holders of the run grant (971's gap note replaced). No hand-written control was added: the ratchet is unchanged.

Proof: `store-record-model.test.ts` (8) and `kept-runs-model.test.ts` (8) green; the menu and access tests extended;
`npm test` 998 files green; `typecheck` and `lint` green. Drives on Edge (`PLAYWRIGHT_CHANNEL=msedge`), LTR and RTL:
`tools/sourcing-record-drive.mjs` 98/98, `tools/sourcing-simulator-drive.mjs` 222/222,
`tools/sourcing-results-drive.mjs` 299/299 (the link is absent under the view grant alone; with the run grant it is
present and opens the simulator on the run).

**2026-11-27 — Reconciled with BackOffice 4355–4381 (4373, 4379, 4380, 4381, 4386) at pricing2 35a4e56be.** Store record door: `GET SourcingAdvisor/StoreRecords` → `StoreRecordListReply` (web JSON: ISO times with a `T`, nulls written), a row per pair of the modes with a record, measures `LATE`/`RETURNED`/`CANCELLED`/`NEVER_READY`/`READY_LATE`/`CALLOUT_IGNORED` with a band index 0–3 and `countedChannels`. Kept runs: `POST Runs/Keep {runId, name}` → `KeptRunAnswer`; `GET Runs/Kept` lists every keeper's runs (the list now shows them all, with the keeper; delete only for `keptBy` = the session user); `POST Runs/Delete {runId}`; `GET Runs/Open?runId=` → the record with `openedAgain { engine, samePlans }` (the banner reads the kept run's name off the list). Names up to 200 characters. Remaining SERVER GAPs: the store record list sends no store name, no failure price, no cost or credit per measure or pair, no like stores' share of till moves and nothing "shown, not charged" (last count, count factor, a donor's refusals); the carrier modes' pairs are not listed; a kept run's row carries no order number and no weight set. Proof: `npm test`, `npm run typecheck`, `npm run lint` green; `tools/sourcing-simulator-drive.mjs` 222/222 and `tools/sourcing-record-drive.mjs` 96/96 on Edge, LTR and RTL, against stubs serving the server's shapes.
