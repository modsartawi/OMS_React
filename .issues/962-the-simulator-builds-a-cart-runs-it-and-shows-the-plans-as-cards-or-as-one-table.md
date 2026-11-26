---
status: open
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

- [ ] `plans-table-model.test.ts` — a real reply of the door gives the rows per measure and the columns per plan, with tags · vitest (`npm test`)
- [ ] `plans-list-model.test.ts` — goals with no plan and hidden plans are listed with their reason · vitest (`npm test`)
- [ ] `error-text.test.ts` — every door error code has English and Arabic text · vitest (`npm test`)
- [ ] `map-place-customer.test.ts` — a click on the panel places the customer · vitest (`npm test`)
- [ ] `tools/sourcing-simulator-drive.mjs` — build a cart, run, switch cards to table, in English and in Arabic (right to left) · Playwright drive, run by hand against stubs

## Boundaries

New page behind the run grant. Can start on a stubbed reply before the BackOffice tickets land; reconcile to the real wire when they do.

## Done when

The model tests are green and the drive passes in both languages against stubs.

## Blocked by

BackOffice 4355 (`.issues/4355-a-hand-built-cart-gets-a-recommended-plan-from-the-users-route.md`),
BackOffice 4356 (`.issues/4356-the-five-plan-goals-the-rules-of-the-search-and-the-tie-breaks-give-the-same-plans-twice-and-cp.md`),
BackOffice 4357 (`.issues/4357-the-simple-plan-the-four-endings-the-work-budget-and-the-plans-shown.md`)
