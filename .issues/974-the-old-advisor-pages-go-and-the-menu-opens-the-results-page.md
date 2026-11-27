---
status: done
spec: BackOffice 4354
blocked-by: 971, BO 4397
---

# 974 — The old advisor pages go, and the menu opens the results page

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Remove today's two advisor pages, their models, queries, columns, the placeholder banner and their locale keys.
- The menu entry "Sourcing advisor" opens the results page. The old order route opens that order's stored run in the simulator, or says it has none and offers a replay.
- Ships together with the BackOffice ticket that removes the old doors.

## Spine reach

oms-react: routes / pages removed / locales / tests

## Proof (→ `tdd` red-green cycles)

- [x] `old-order-link-model.test.ts` — a stored run opens the simulator; none offers a replay · vitest (`npm test`)
- [x] `tools/sourcing-old-link-drive.mjs` (a small drive of its own, in place of extending `sourcing-results-drive.mjs`) — the menu entry opens the results page; the old order link answers · Playwright drive, run by hand against stubs

## Boundaries

Removal; ships with the BackOffice release that retires the scorer.

## Done when

The old pages are gone, the model test is green and the drive passes.

## Blocked by

[971](971-the-comparison-results-page-one-sentence-one-bar-three-panels-where-the-plans-differ-and-a-figur.md),
BackOffice 4397 (`.issues/4397-the-nightly-scorer-is-retired-and-the-copilot-answers-from-the-comparison.md`)

## Comments

**2026-11-27 — built, on the real server.** Reconciled with BackOffice 4397 at pricing2 35a4e56be (commit `f67e30f1d`,
the old order link door). Ships in ONE release with BackOffice 4397, which removes the doors the old pages called.

- **Removed:** `src/features/oms/sourcing-advisor/` whole (both pages, `api.ts`, `paths.ts`, `refusal.ts`,
  `PlaceholderBanner.tsx`, `summary-columns.tsx`, the summary and explain models and queries with their tests),
  `src/core/models/sourcing-advisor.ts`, the `sourcing-advisor` namespace (`en` + `ar`) and its `core/i18n.ts`
  registration, `tools/sourcing-advisor-drive.mjs` and its `.gitignore` line.
- **Menu:** "Sourcing advisor" (`sourcing-results:menu.sourcingAdvisor`, the label moved into the results namespace)
  opens `/oms/sourcing-results`, lit there and on the old order link; same grant, same place (`menu-model.test.ts`).
  The old entry address `/oms/sourcing-advisor` redirects to the results page (its old filters dropped).
- **Old order route** `/oms/sourcing-advisor/order/:orderNo` (Delivery details' "Why this store?" still links there):
  a small feature, `src/features/oms/sourcing-order-link/` (namespace `sourcing-order-link`), under the view grant.
  It asks `GET SourcingAdvisor/Results/OrderRun?orderNumber=` (an order or a delivery number;
  `src/core/models/sourcing-order-run.ts` is its reply) and, through `old-order-link-model.ts`: a stored run opens in
  the simulator (`simulatorRunPath`, `replace`) for a holder of the run grant (`canOpenStoredRun`); under the view
  grant alone the run is named and the simulator not opened; with none it says so and offers a replay of the
  **order** (`simulatorReplayPath`, new in `@/core/sourcing-advisor/simulator-path`), which the simulator reads back
  into its replay start (`replayOrderOf`, a three-line change to `SourcingSimulatorPage`; nothing runs until Run);
  a number naming no order says so; a blank number never asks the door.
- **Copilot:** BackOffice 4397 replaced the tool `sourcing_savings` with `sourcing_comparison`; the trace map, the
  walked steps and their `en`/`ar` labels follow.
- Proof: `old-order-link-model.test.ts` (9) red then green, `simulator-path.test.ts` (+1), `menu-model.test.ts`.
  `tools/sourcing-old-link-drive.mjs` 38/38 on Edge, LTR and RTL (`DRIVE_PORT=<port> PLAYWRIGHT_CHANNEL=msedge`).

**Gaps.** The results page has no deep link to one order's card, so `hasSummary` only offers the results page
itself. The run grant key is still the provisional one the simulator's reconciler settles (`@/core/sourcing-advisor/access`);
the drive reads it from there.
