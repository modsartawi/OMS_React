---
status: open
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

- [ ] `store-record-model.test.ts` — the rows per measure with the neutral-default mark and the channels counted · vitest (`npm test`)
- [ ] `kept-runs-model.test.ts` — the list and what a link opens · vitest (`npm test`)
- [ ] `tools/sourcing-record-drive.mjs` — open the list, keep a run, open it by link · Playwright drive, run by hand against stubs

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
