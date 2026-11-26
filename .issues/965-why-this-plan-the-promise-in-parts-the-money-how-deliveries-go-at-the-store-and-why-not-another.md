---
status: open
spec: BackOffice 4354
blocked-by: 962, BO 4379, BO 4363, BO 4366, BO 4386
---

# 965 — Why this plan: the promise in parts, the money, how deliveries go at the store, and why not another store

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- The tab "Why this plan", top to bottom:
- the promise, in parts: a bar per Dawaa Now shipment (made ready, courier wait, travel, margin, each with its source), the pick end, the usual time beside it, lengtheners marked "adds nothing" where so; a slot shipment lists the slots skipped and why, which rule set its pick end, and its next two slots with the mark when a later one was cheaper;
- the money: a row per part, a column per shipment, every rate with its source, and a banner naming the assumed ones;
- how deliveries go at this store: a row per measure against like stores, with the deliveries behind it and its cost or credit. Never the words "fault", "performance" or "rating";
- why not another store: pick a store and get, per mode, the rule that removed it or the best plan that uses it and what it would cost more.
- A line planned on a short stock figure shows its plain sentence with its own chance ("About 8 in 100 such lines are not handed over at this store"), never "out of stock".
- The tab "What the run used": every factor with how it enters, whether it ran on real data, a neutral default or an assumption, or was switched off, and its source; four counts on top. The marks of the run ("straight line", "assumption", "no location", "list fee", "range not confirmed", "figures as read at {time}").

## Spine reach

oms-react: page / models / locales / tests

## Proof (→ `tdd` red-green cycles)

- [ ] `promise-bar-model.test.ts` — the parts, their sources and the pick end from a reply · vitest (`npm test`)
- [ ] `money-rows-model.test.ts` — rows per part, columns per shipment, the assumed banner · vitest (`npm test`)
- [ ] `why-not-model.test.ts` — a removed store gives its rule; a standing one gives the extra cost by part · vitest (`npm test`)
- [ ] `used-factors-model.test.ts` — the four counts and the list · vitest (`npm test`)
- [ ] `tools/sourcing-simulator-drive.mjs` — open both tabs on a split plan, in both languages · Playwright drive, run by hand against stubs

## Boundaries

—

## Done when

The model tests are green and the drive passes.

## Blocked by

[962](962-the-simulator-builds-a-cart-runs-it-and-shows-the-plans-as-cards-or-as-one-table.md),
BackOffice 4379 (`.issues/4379-the-run-record-carries-every-figure-the-run-read-at-three-levels-with-a-code-for-every-reason.md`),
BackOffice 4363 (`.issues/4363-the-money-delivery-rates-and-fee-rules-carry-their-source-a-split-charges-a-fee-per-shipment-and.md`),
BackOffice 4366 (`.issues/4366-pick-up-is-promised-its-target-the-three-lengtheners-only-lengthen-and-the-promise-sentence-is-b.md`),
BackOffice 4386 (`.issues/4386-the-store-record-and-the-slot-costs-move-the-choice-between-stores-of-one-mode.md`)
